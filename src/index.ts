
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ValidateEmail } from './utils/emailValidator';
import SubscriptionRequestModel from './models/subscriptionRequestModel';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
const gmail_credential = require("./config/gmail.token");
const nodeMailer = require('nodemailer');
admin.initializeApp(functions.config().firebase); 
const firestore = admin.firestore();
const authService = admin.auth();

 exports.sendVerificationCode = functions.https.onCall(async (data, context) => {
    const email = data.email;
    let userRecord;
                   if(!email || !ValidateEmail(email) ){
                    throw new functions.https.HttpsError('invalid-argument', 'Email is not Valid', email);
                  }
                  try{
                    userRecord = await authService.getUserByEmail(email);
                    if(userRecord && userRecord.emailVerified){
                        const doc: FirebaseFirestore.QuerySnapshot = await firestore.collection("users").where("email", "==", email).get();
                        if(doc.docs.length != 0 ){
                          return {code: "email-exist", message: "email is already used"}
                        }
                        return {code: "email-verified", message: "email is already verified"}
                    }
                    } catch(err){
                    console.log("okey user dont exist you can pass... ",err);
                }
                 console.log("generate code ... ");
                  const verificationCode = Math.floor(100000 + Math.random() * 900000);
                  try{
                    await firestore.collection('subscription-requests').doc(email).set({
                      email,
                      verification_code: verificationCode,
                      verified: false  
                  })
                  }catch(err){
                    console.log(err); 
                    throw new functions.https.HttpsError('internal', 'Error Creating Subscription Request', err);
                  }

                  let transporter =  nodeMailer.createTransport({
                    service: 'gmail',
                    port: 465,
                    secure: true,
                    auth: {
                        type: "OAuth2",
                        user: gmail_credential.user,
                        clientId: gmail_credential.clientId,
                        clientSecret: gmail_credential.clientSecret,
                        refreshToken: gmail_credential.refreshToken,
                        accessToken: gmail_credential.accessToken,
                    }
                  });
                  
                  transporter.on('token', async (token: any) => {
                    //console.log('A new access token was generated');
                    //console.log('User: %s', token.user);
                    //console.log('Access Token: %s', token.accessToken);
                   try{
                    await firestore.collection("credentials").doc("token").set({
                        token: token.accessToken,
                        user: token.user.toString(),
                        expires: new Date(token.expires)
                    })
                   }catch(er){
                            console.error("refgresg ", er);
                   }
                 
                    console.log('Expires: %s', new Date(token.expires));
                });

                let mailOptions = {
                    from: 'cv upload Service', // sender address
                    to: email, // list of receivers,
                    subject: "Email Verification Code ", // Subject line
                    html: `<p>Your Verification Code : ${verificationCode} </p>`  // html body
                };
               return transporter.sendMail(mailOptions).catch( (err: any) =>{
                 console.log(err);
                throw new functions.https.HttpsError('internal', 'Internal Server Error', err);
               })
             
 
  });

  exports.verifyEmail = functions.https.onCall(async (data, context) => {
        const code = data.code;
        const password = data.password;
        const email = data.email;
        let userRecord;
        const doc :  DocumentSnapshot = await firestore.collection('subscription-requests').doc(email).get();
        const requestBody: SubscriptionRequestModel = <SubscriptionRequestModel> doc.data();
        if(doc && requestBody.verification_code == Number(code) ){
            try{
                  await doc.ref.update({verified: true})
                  userRecord =  await authService.createUser({
                    email: email,
                    emailVerified: true,
                    password: password
                  });
                  await doc.ref.delete();
                  await authService.setCustomUserClaims(userRecord.uid,{
                    user: true
                  });
                 return userRecord.toJSON()
              } catch(err){
                throw new functions.https.HttpsError('internal', 'Internal Server Error', err);
                }

        }else {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid Verification Code is Provided');
        }
   })
