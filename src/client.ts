import { UserSchema } from "./contracts/user.ts";

const response = await fetch("http://localhost:3000/api/user");

const data: unknown = await response.json();

const result = UserSchema.safeParse(data);

if (!result.success) {
    console.error("Invalid user data:", result.error);
} else {
    const user = result.data;

    console.log("Valid user:", user);
    console.log("User name:", user.name);
}