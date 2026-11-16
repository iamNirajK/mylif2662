import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App singleton
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const provider = new GoogleAuthProvider();

// Configured Workspace Scopes
export const WORKSPACE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/contacts",
  "https://www.googleapis.com/auth/forms.body",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
];

WORKSPACE_SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: "consent",
  access_type: "offline",
});

// Flag and shared promise to prevent overlapping signInWithPopup calls
let isSigningIn = false;
let inFlightSignIn: Promise<{ user: User; accessToken: string } | null> | null = null;
// Cache the access token in memory (NEVER store in localStorage per security guidelines)
let cachedAccessToken: string | null = null;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // User is signed in with Firebase, but access token memory cache expired or fresh session
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (inFlightSignIn) {
    return inFlightSignIn;
  }

  isSigningIn = true;
  inFlightSignIn = (async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error("Failed to get Google access token from authentication result");
      }

      cachedAccessToken = credential.accessToken;
      return { user: result.user, accessToken: cachedAccessToken };
    } catch (error: any) {
      const code = error?.code || "";
      if (
        code === "auth/cancelled-popup-request" ||
        code === "auth/popup-closed-by-user"
      ) {
        return null;
      }
      console.error("JIYA Google Sign-in error:", error);
      throw error;
    } finally {
      isSigningIn = false;
      inFlightSignIn = null;
    }
  })();

  return inFlightSignIn;
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setAccessTokenInMemory = (token: string | null) => {
  cachedAccessToken = token;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
