export function ValidateEmail(email: any)
{
const mailformat = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
return (email.match(mailformat))? true: false;
}