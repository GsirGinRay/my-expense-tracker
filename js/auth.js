import {
  api,
  setToken,
  clearToken,
  getToken,
  setStoredUser,
  getStoredUser,
} from './api.js';

export function isAuthed() {
  return !!getToken();
}

export function currentUser() {
  return getStoredUser();
}

export async function login(email, password) {
  const { token, user } = await api.login(email, password);
  setToken(token);
  setStoredUser(user);
  return user;
}

export async function register(email, password) {
  const { token, user } = await api.register(email, password);
  setToken(token);
  setStoredUser(user);
  return user;
}

export function logout() {
  clearToken();
}
