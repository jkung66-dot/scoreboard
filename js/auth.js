// 控制面板登入（Firebase Email/密碼）。Overlay 唔使登入，只係讀取。

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "./vendor/firebase/firebase-auth.js";
import { getFirebaseApp } from "./store.js";

let auth = null;

function getAuthInstance() {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
    // 登入一次之後，手機重開瀏覽器都保持登入
    setPersistence(auth, browserLocalPersistence).catch(() => {});
  }
  return auth;
}

export function watchAuth(callback) {
  return onAuthStateChanged(getAuthInstance(), callback);
}

export async function login(email, password) {
  try {
    await signInWithEmailAndPassword(getAuthInstance(), email.trim(), password);
  } catch (err) {
    throw new Error(describeAuthError(err));
  }
}

export function logout() {
  return signOut(getAuthInstance());
}

function describeAuthError(err) {
  switch (err?.code) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email 或密碼唔啱";
    case "auth/invalid-email":
      return "Email 格式唔啱";
    case "auth/too-many-requests":
      return "試得太多次，請等一陣再試";
    case "auth/network-request-failed":
      return "網絡連唔到，請檢查上網";
    case "auth/operation-not-allowed":
      return "Firebase 未開啟 Email/密碼登入（Authentication → Sign-in method）";
    case "auth/unauthorized-domain":
      return "呢個網址未加入 Firebase 授權網域（Authentication → Settings → Authorized domains）";
    default:
      return `登入失敗：${err?.message || err}`;
  }
}
