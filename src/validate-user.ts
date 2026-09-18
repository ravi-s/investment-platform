import { UserSchema, type User } from "./contracts/user.ts";

const responseData: unknown = {
    id: "1",
    name: "Ravi",
    email: "test", // Invalid email to trigger validation error
};

const result = UserSchema.safeParse(responseData);

if (!result.success) {
    console.error("Invalid user data:", result.error);
} else {
    const user = result.data;

    console.log("Valid user:", user);
    console.log("Name:", user.name);
}