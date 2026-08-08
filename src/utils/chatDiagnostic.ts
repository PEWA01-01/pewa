import { ref, get } from 'firebase/database';
import { rtdb } from '../firebase';

export interface ChatDiagnosticResult {
  rtdbConnected: boolean;
  totalChatsInRTDB: number;
  matchingUserChats: Array<{
    chatId: string;
    hasParticipantsObject: boolean;
    participantsValue: any;
    participantsList: string[];
    containsUser: boolean;
    lastMessage?: string;
    rawChatData: any;
  }>;
  issues: string[];
}

/**
 * Diagnostic utility function to fetch 'chats/' path from Realtime Database,
 * log all chats containing the current user's UID to console,
 * and verify if the 'participants' object exists for each,
 * helping identify why the ChatsTab list might be empty.
 *
 * @param userId - Optional user UID to filter by (defaults to current user in localStorage)
 */
export async function runChatDiagnostic(userId?: string): Promise<ChatDiagnosticResult> {
  let currentUid = userId;
  if (!currentUid && typeof localStorage !== 'undefined') {
    try {
      const storedId = localStorage.getItem('pewa_current_user_id');
      if (storedId) {
        currentUid = storedId.replace(/"/g, '');
      } else {
        const userObjStr = localStorage.getItem('pewa_current_user');
        if (userObjStr) {
          const userObj = JSON.parse(userObjStr);
          currentUid = userObj?.uid;
        }
      }
    } catch (e) {
      console.warn('[ChatDiagnostic] Could not parse user ID from localStorage:', e);
    }
  }

  console.group(`🔍 [Chat Diagnostic] Inspecting RTDB 'chats/' path for UID: ${currentUid || '(All Users)'}`);
  const issues: string[] = [];

  if (!rtdb) {
    const errorMsg = '❌ Realtime Database (rtdb) instance is null or not initialized!';
    console.error(errorMsg);
    console.groupEnd();
    return {
      rtdbConnected: false,
      totalChatsInRTDB: 0,
      matchingUserChats: [],
      issues: [errorMsg]
    };
  }

  try {
    const chatsRef = ref(rtdb, 'chats');
    console.log("Fetching data snapshot from RTDB path: 'chats/'...");
    const snapshot = await get(chatsRef);
    const chatsData = snapshot.val();

    if (!chatsData || typeof chatsData !== 'object') {
      const msg = "⚠️ 'chats/' path in RTDB is null, empty, or not an object!";
      console.warn(msg);
      issues.push(msg);
      console.groupEnd();
      return {
        rtdbConnected: true,
        totalChatsInRTDB: 0,
        matchingUserChats: [],
        issues
      };
    }

    const allChatKeys = Object.keys(chatsData);
    console.log(`✅ Retrieved ${allChatKeys.length} total chats from RTDB.`);

    const matchingUserChats: ChatDiagnosticResult['matchingUserChats'] = [];

    allChatKeys.forEach((chatId) => {
      const chat = chatsData[chatId];
      if (!chat || typeof chat !== 'object') return;

      const pObj = chat.participants;
      const hasParticipantsObject = Boolean(pObj && typeof pObj === 'object' && !Array.isArray(pObj));
      
      let pList: string[] = [];
      if (Array.isArray(pObj)) {
        pList = pObj;
      } else if (pObj && typeof pObj === 'object') {
        pList = Object.keys(pObj);
      } else if (Array.isArray(chat.participantsList)) {
        pList = chat.participantsList;
      } else if (chatId.includes('_')) {
        pList = chatId.split('_');
      }

      const containsUser = currentUid ? (pList.includes(currentUid) || chatId.includes(currentUid)) : true;

      if (containsUser) {
        if (!hasParticipantsObject) {
          issues.push(`Chat '${chatId}' is missing a valid 'participants' object (value: ${JSON.stringify(pObj)}).`);
        }

        matchingUserChats.push({
          chatId,
          hasParticipantsObject,
          participantsValue: pObj,
          participantsList: pList,
          containsUser,
          lastMessage: chat.lastMessage || null,
          rawChatData: chat
        });
      }
    });

    console.log(`📊 Matched ${matchingUserChats.length} chats for UID '${currentUid || 'ALL'}':`);
    console.table(
      matchingUserChats.map((c) => ({
        'Chat ID': c.chatId,
        'Has participants Object': c.hasParticipantsObject ? '✅ YES' : '❌ NO',
        'Participants List': c.participantsList.join(', '),
        'Last Message': c.lastMessage || '(none)'
      }))
    );

    if (issues.length > 0) {
      console.warn('⚠️ Issues found during diagnostic:', issues);
    } else {
      console.log('🎉 All matched chats contain a valid participants object!');
    }

    console.groupEnd();

    return {
      rtdbConnected: true,
      totalChatsInRTDB: allChatKeys.length,
      matchingUserChats,
      issues
    };
  } catch (err: any) {
    const errMsg = `❌ Error querying RTDB 'chats/': ${err?.message || err}`;
    console.error(errMsg);
    console.groupEnd();
    return {
      rtdbConnected: true,
      totalChatsInRTDB: 0,
      matchingUserChats: [],
      issues: [errMsg]
    };
  }
}

// Attach to window object for execution in browser developer console
if (typeof window !== 'undefined') {
  (window as any).runChatDiagnostic = runChatDiagnostic;
}
