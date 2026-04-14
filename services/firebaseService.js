const admin = require('firebase-admin');

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: privateKey,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`,
  universe_domain: 'googleapis.com'
};


if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const verifyIdToken = async (idToken) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return { success: true, decodedToken };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const getUserByUID = async (uid) => {
  const user = await admin.auth().getUser(uid);
  return user;
};

const createCustomToken = async (uid) => {
  const token = await admin.auth().createCustomToken(uid);
  return token;
};

const sendPushNotification = async (token, title, body, data) => {
  const message = {
    notification: { title, body },
    token,
    ...(data && { data }),
  };

  const res = await admin.messaging().send(message);
  return res;
};

const sendMulticastNotification = async (tokens, title, body, data) => {
  if (!tokens?.length) throw new Error('no tokens provided');

  const message = {
    notification: { title, body },
    tokens,
    ...(data && { data }),
  };

  const res = await admin.messaging().sendEachForMulticast(message);

  if (res.failureCount > 0) {

    console.warn(`multicast: ${res.failureCount} failed, ${res.successCount} ok`);
  }

  return res;
};

module.exports = {
  admin,
  verifyIdToken,
  getUserByUID,
  createCustomToken,
  sendPushNotification,
  sendMulticastNotification,
};