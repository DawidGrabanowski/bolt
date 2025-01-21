import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createDataStream } from 'ai';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/common/prompts/prompts';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import type { IProviderSetting } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

const logger = createScopedLogger('api.chat');

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  const items = cookieHeader.split(';').map((cookie) => cookie.trim());

  items.forEach((item) => {
    const [name, ...rest] = item.split('=');

    if (name && rest) {
      const decodedName = decodeURIComponent(name.trim());
      const decodedValue = decodeURIComponent(rest.join('=').trim());
      cookies[decodedName] = decodedValue;
    }
  });

  return cookies;
}

interface ChatRequestBody {
  messages: Messages;
  files: any;
  promptId?: string;
  contextOptimization: boolean;
  userId?: string;
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  try {
    logger.info('Chat action started');
    const cookieHeader = request.headers.get('Cookie');
    const apiKeys = JSON.parse(parseCookies(cookieHeader || '').apiKeys || '{}');
    const providerSettings: Record<string, IProviderSetting> = JSON.parse(
      parseCookies(cookieHeader || '').providers || '{}',
    );

    const body = await request.json() as ChatRequestBody;
    logger.info('Request body:', {
      hasMessages: !!body.messages?.length,
      hasFiles: !!body.files,
      promptId: body.promptId,
      contextOptimization: body.contextOptimization,
      userId: body.userId,
      messageCount: body.messages?.length
    });

    const { messages, files, promptId, contextOptimization, userId } = body;

    logger.info('Chat action details:', {
      userId,
      hasApiKeys: !!apiKeys && Object.keys(apiKeys).length > 0,
      hasProviderSettings: !!providerSettings && Object.keys(providerSettings).length > 0,
      messageCount: messages?.length,
      firstMessageType: messages?.[0]?.role
    });

    if (!userId) {
      logger.error('Missing userId in request');
      throw new Response('User ID is required', {
        status: 401,
        statusText: 'Unauthorized',
      });
    }

    const stream = new SwitchableStream();

    const cumulativeUsage = {
      completionTokens: 0,
      promptTokens: 0,
      totalTokens: 0,
    };

    const options: StreamingOptions = {
      toolChoice: 'none',
      onFinish: async ({ text: content, finishReason, usage }) => {
        logger.debug('usage', JSON.stringify(usage));

        if (usage) {
          cumulativeUsage.completionTokens += usage.completionTokens || 0;
          cumulativeUsage.promptTokens += usage.promptTokens || 0;
          cumulativeUsage.totalTokens += usage.totalTokens || 0;
        }

        if (finishReason !== 'length') {
          const encoder = new TextEncoder();
          const usageStream = createDataStream({
            async execute(dataStream) {
              dataStream.writeMessageAnnotation({
                type: 'usage',
                value: {
                  completionTokens: cumulativeUsage.completionTokens,
                  promptTokens: cumulativeUsage.promptTokens,
                  totalTokens: cumulativeUsage.totalTokens,
                },
              });
            },
            onError: (error: any) => `Custom error: ${error.message}`,
          }).pipeThrough(
            new TransformStream({
              transform: (chunk, controller) => {
                // Convert the string stream to a byte stream
                const str = typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
                controller.enqueue(encoder.encode(str));
              },
            }),
          );
          await stream.switchSource(usageStream);
          await new Promise((resolve) => setTimeout(resolve, 0));
          stream.close();

          return;
        }

        if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
          throw Error('Cannot continue message: Maximum segments reached');
        }

        const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

        logger.info(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

        messages.push({ role: 'assistant', content });
        messages.push({ role: 'user', content: CONTINUE_PROMPT });

        const result = await streamText({
          messages,
          env: context.cloudflare.env,
          options,
          apiKeys,
          files,
          providerSettings,
          promptId,
          contextOptimization,
          userId,
        });

        stream.switchSource(result.toDataStream());

        return;
      },
    };

    const result = await streamText({
      messages,
      env: context.cloudflare.env,
      options,
      apiKeys,
      files,
      providerSettings,
      promptId,
      contextOptimization,
      userId,
    });

    stream.switchSource(result.toDataStream());

    return new Response(stream.readable, {
      status: 200,
      headers: {
        contentType: 'text/plain; charset=utf-8',
      },
    });
  } catch (error: any) {
    logger.error('Chat action error:', error);
    logger.error('Error stack:', error.stack);

    if (error instanceof Response) {
      throw error;
    }

    if (error.message?.includes('API key')) {
      throw new Response('Invalid or missing API key', {
        status: 401,
        statusText: 'Unauthorized',
      });
    }

    const errorMessage = error.message || 'An unexpected error occurred';
    logger.error('Error details:', {
      message: errorMessage,
      type: error.constructor.name,
      code: error.code,
      name: error.name
    });
    
    throw new Response(errorMessage, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
