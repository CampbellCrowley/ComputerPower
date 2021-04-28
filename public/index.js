// Your web app's Firebase configuration
var firebaseConfig = {
  apiKey: "AIzaSyAmWKE4REuEBrjLWcyl0qtzO4podKVoLIc",
  authDomain: "campbells-app.firebaseapp.com",
  databaseURL: "https://campbells-app.firebaseio.com",
  projectId: "campbells-app",
  storageBucket: "campbells-app.appspot.com",
  messagingSenderId: "275682034627",
  appId: "1:275682034627:web:3cb41f04dd69a6efc5f376"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize the FirebaseUI Widget using Firebase.
var ui = new firebaseui.auth.AuthUI(firebase.auth());

ui.start('#firebase-auth', {
  signInOptions: [
    // List of OAuth providers supported.
    firebase.auth.GoogleAuthProvider.PROVIDER_ID,
  ],
  callbacks: {
    signInSuccessWithAuthResult: onSignIn,
  },
  signInFlow: 'popup',
});

function onSignIn(authResult, redirectUrl) {
  console.log('Sign In:', authResult, redirectUrl);
  // Return type determines whether we continue the redirect automatically.
  return true;
}

function getIdToken(cb) {
  firebase.auth()
      .currentUser.getIdToken(/* forceRefresh */ true)
      .then(function(token) {
        cb(null, token);
      })
      .catch(function(error) {
        cb(error);
      });
}

function fetchUserInfo() {

}
