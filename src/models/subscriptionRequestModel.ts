export default interface SubscriptionRequestModel {
    email: string;
    verification_code: number;
    verified?: boolean;

}