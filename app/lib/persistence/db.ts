import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import type { ChatHistoryItem } from './useChatHistory';

const logger = createScopedLogger('ChatHistory');

// this is used at the top level and never rejects
export async function openDatabase(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === 'undefined') {
    console.error('indexedDB is not available in this environment.');
    return undefined;
  }

  return new Promise((resolve) => {
    const request = indexedDB.open('boltHistory', 2);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        // Initial schema creation
        const store = db.createObjectStore('chats', { keyPath: 'id' });
        store.createIndex('id', 'id', { unique: true });
        store.createIndex('urlId', 'urlId', { unique: true });
      }

      if (oldVersion < 2) {
        // Add userId field and index
        const store = request.transaction!.objectStore('chats');
        if (!store.indexNames.contains('userId')) {
          store.createIndex('userId', 'userId', { unique: false });
        }
      }
    };

    request.onsuccess = (event: Event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event: Event) => {
      resolve(undefined);
      logger.error((event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function getAll(db: IDBDatabase, userId: string): Promise<ChatHistoryItem[]> {
  logger.info('Getting all chats for user:', userId);
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const index = store.index('userId');
    const request = index.getAll(userId);

    request.onsuccess = () => {
      logger.info('Successfully retrieved chats:', {
        userId,
        count: request.result.length
      });
      resolve(request.result as ChatHistoryItem[]);
    };
    request.onerror = () => {
      logger.error('Failed to get chats:', {
        userId,
        error: request.error
      });
      reject(request.error);
    };
  });
}

export async function setMessages(
  db: IDBDatabase,
  id: string,
  messages: Message[],
  userId: string,
  urlId?: string,
  description?: string,
  timestamp?: string,
): Promise<void> {
  logger.info('Setting messages:', {
    chatId: id,
    userId,
    messageCount: messages.length
  });

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');

    if (timestamp && isNaN(Date.parse(timestamp))) {
      reject(new Error('Invalid timestamp'));
      return;
    }

    const request = store.put({
      id,
      userId,
      messages,
      urlId,
      description,
      timestamp: timestamp ?? new Date().toISOString(),
    });

    request.onsuccess = () => {
      logger.info('Successfully saved messages:', {
        chatId: id,
        userId
      });
      resolve();
    };
    request.onerror = () => {
      logger.error('Failed to save messages:', {
        chatId: id,
        userId,
        error: request.error
      });
      reject(request.error);
    };
  });
}

export async function getMessages(db: IDBDatabase, id: string, userId: string): Promise<ChatHistoryItem> {
  logger.info('Getting messages:', {
    chatId: id,
    userId
  });

  return (await getMessagesById(db, id, userId)) || (await getMessagesByUrlId(db, id, userId));
}

export async function getMessagesByUrlId(db: IDBDatabase, id: string, userId: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const index = store.index('urlId');
    const request = index.get(id);

    request.onsuccess = () => {
      const chat = request.result as ChatHistoryItem;
      if (!chat) {
        logger.info('Chat not found:', { urlId: id });
        resolve(chat);
        return;
      }
      
      if (chat.userId !== userId) {
        logger.error('Unauthorized access attempt:', {
          chatId: id,
          requestedByUserId: userId,
          ownerUserId: chat.userId
        });
        reject(new Error('Unauthorized access to chat'));
        return;
      }
      
      logger.info('Successfully retrieved chat:', {
        urlId: id,
        userId,
        messageCount: chat.messages.length
      });
      resolve(chat);
    };
    request.onerror = () => {
      logger.error('Failed to get chat by urlId:', {
        urlId: id,
        userId,
        error: request.error
      });
      reject(request.error);
    };
  });
}

export async function getMessagesById(db: IDBDatabase, id: string, userId: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.get(id);

    request.onsuccess = () => {
      const chat = request.result as ChatHistoryItem;
      if (!chat) {
        logger.info('Chat not found:', { id });
        resolve(chat);
        return;
      }
      
      if (chat.userId !== userId) {
        logger.error('Unauthorized access attempt:', {
          chatId: id,
          requestedByUserId: userId,
          ownerUserId: chat.userId
        });
        reject(new Error('Unauthorized access to chat'));
        return;
      }
      
      logger.info('Successfully retrieved chat:', {
        chatId: id,
        userId,
        messageCount: chat.messages.length
      });
      resolve(chat);
    };
    request.onerror = () => {
      logger.error('Failed to get chat by id:', {
        chatId: id,
        userId,
        error: request.error
      });
      reject(request.error);
    };
  });
}

export async function deleteById(db: IDBDatabase, id: string, userId: string): Promise<void> {
  logger.info('Attempting to delete chat:', {
    chatId: id,
    userId
  });

  // First verify the user owns this chat
  const chat = await getMessages(db, id, userId);
  if (!chat) {
    logger.error('Chat not found for deletion:', {
      chatId: id,
      userId
    });
    throw new Error('Chat not found');
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');
    const request = store.delete(id);

    request.onsuccess = () => {
      logger.info('Successfully deleted chat:', {
        chatId: id,
        userId
      });
      resolve(undefined);
    };
    request.onerror = () => {
      logger.error('Failed to delete chat:', {
        chatId: id,
        userId,
        error: request.error
      });
      reject(request.error);
    };
  });
}

export async function getNextId(db: IDBDatabase): Promise<string> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAllKeys();

    request.onsuccess = () => {
      const highestId = request.result.reduce((cur, acc) => Math.max(+cur, +acc), 0);
      resolve(String(+highestId + 1));
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getUrlId(db: IDBDatabase, id: string): Promise<string> {
  const idList = await getUrlIds(db);

  if (!idList.includes(id)) {
    return id;
  } else {
    let i = 2;

    while (idList.includes(`${id}-${i}`)) {
      i++;
    }

    return `${id}-${i}`;
  }
}

async function getUrlIds(db: IDBDatabase): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const idList: string[] = [];

    const request = store.openCursor();

    request.onsuccess = (event: Event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

      if (cursor) {
        idList.push(cursor.value.urlId);
        cursor.continue();
      } else {
        resolve(idList);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function forkChat(db: IDBDatabase, chatId: string, messageId: string, userId: string): Promise<string> {
  try {
    logger.info('Forking chat:', {
      chatId,
      messageId,
      userId
    });

    // First verify the user has access to the chat
    const chat = await getMessages(db, chatId, userId);

    if (!chat) {
      logger.error('Chat not found for forking:', {
        chatId,
        userId
      });
      throw new Error('Chat not found');
    }

    logger.info('Found chat to fork:', {
      chatId,
      description: chat.description,
      messageCount: chat.messages.length,
      chatUserId: chat.userId
    });

    // Find the index of the message to fork at
    const messageIndex = chat.messages.findIndex((msg) => msg.id === messageId);

    if (messageIndex === -1) {
      logger.error('Message not found in chat:', {
        chatId,
        messageId,
        availableMessageIds: chat.messages.map(m => m.id)
      });
      throw new Error('Message not found');
    }

    // Get messages up to and including the selected message
    const messages = chat.messages.slice(0, messageIndex + 1);

    logger.info('Creating forked chat:', {
      originalChatId: chatId,
      messageCount: messages.length,
      userId
    });

    // Create new chat with the same userId to maintain ownership
    const newChatId = await createChatFromMessages(
      db, 
      chat.description ? `${chat.description} (fork)` : 'Forked chat', 
      messages, 
      userId
    );

    logger.info('Successfully forked chat:', {
      originalChatId: chatId,
      newChatId,
      userId
    });

    return newChatId;
  } catch (error) {
    logger.error('Failed to fork chat:', {
      error,
      chatId,
      messageId,
      userId,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });

    if (error instanceof Error && error.message === 'Unauthorized access to chat') {
      throw error; // Re-throw unauthorized error
    }
    throw new Error(`Failed to fork chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function duplicateChat(db: IDBDatabase, id: string, userId: string): Promise<string> {
  logger.info('Duplicating chat:', {
    chatId: id,
    userId
  });

  const chat = await getMessages(db, id, userId);

  if (!chat) {
    logger.error('Chat not found for duplication:', {
      chatId: id,
      userId
    });
    throw new Error('Chat not found');
  }

  const newChatId = await createChatFromMessages(
    db, 
    `${chat.description || 'Chat'} (copy)`, 
    chat.messages, 
    userId
  );

  logger.info('Successfully duplicated chat:', {
    originalChatId: id,
    newChatId,
    userId
  });

  return newChatId;
}

export async function createChatFromMessages(
  db: IDBDatabase,
  description: string,
  messages: Message[],
  userId: string,
): Promise<string> {
  logger.info('Creating new chat from messages:', {
    userId,
    messageCount: messages.length
  });

  const newId = await getNextId(db);
  const newUrlId = await getUrlId(db, newId);

  await setMessages(
    db,
    newId,
    messages,
    userId,
    newUrlId,
    description,
  );

  logger.info('Successfully created new chat:', {
    chatId: newId,
    urlId: newUrlId,
    userId
  });

  return newUrlId;
}

export async function updateChatDescription(db: IDBDatabase, id: string, description: string, userId: string): Promise<void> {
  logger.info('Updating chat description:', {
    chatId: id,
    userId
  });

  const chat = await getMessages(db, id, userId);

  if (!chat) {
    logger.error('Chat not found for description update:', {
      chatId: id,
      userId
    });
    throw new Error('Chat not found');
  }

  if (!description.trim()) {
    logger.error('Invalid description:', {
      chatId: id,
      userId,
      description
    });
    throw new Error('Description cannot be empty');
  }

  await setMessages(db, id, chat.messages, userId, chat.urlId, description, chat.timestamp);

  logger.info('Successfully updated chat description:', {
    chatId: id,
    userId
  });
}
