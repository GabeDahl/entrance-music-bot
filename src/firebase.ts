import { db } from './main.js';
import {
  WithFieldValue,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

export interface User {
  id: string;
  musicConfig: {
    duration: string;
    lastSetBy: string;
    mode: string;
    startAt: string;
    url: string;
  };
}
const userConverter = {
  toFirestore(user: WithFieldValue<User>) {
    return { ...user, id: undefined };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot) {
    const data = snapshot.data() as User;
    return {
      id: snapshot.id,
      ...data,
    };
  },
};
const usersCollection = db.collection('users').withConverter(userConverter);

export async function getUsers(): Promise<User[]> {
  try {
    const querySnapshot = await usersCollection.get();
    const users: User[] = querySnapshot.docs.map((doc) => doc.data() as User);
    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}
