import { db } from './main.js';
import {
  WithFieldValue,
  QueryDocumentSnapshot,
  CollectionReference,
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

let _usersCollection: CollectionReference;
const getUsersCollection = () => {
  if (!_usersCollection) {
    _usersCollection = db.collection('users').withConverter(userConverter);
  }
  return _usersCollection;
};

export async function getUsers(): Promise<User[]> {
  try {
    const querySnapshot = await getUsersCollection().get();
    const users: User[] = querySnapshot.docs.map((doc) => doc.data() as User);
    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}
