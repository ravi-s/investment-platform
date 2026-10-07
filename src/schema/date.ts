import { z } from "zod";

export const DateOnlySchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .refine(
        (value) => {
            const parts: number[] = value.split("-").map(Number);
            const [year, month, day] = parts as [number, number, number];
            const date = new Date(Date.UTC(year, month - 1, day));

            return (
                date.getUTCFullYear() === year &&
                date.getUTCMonth() === month - 1 &&
                date.getUTCDate() === day
            );
        },
        "Invalid calendar date"
    );