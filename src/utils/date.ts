/**
 * Returns the calendar date immediately preceding the given ISO date string.
 */
export function previousDate(dateString: string): string {
    const parts = dateString.split("-").map(Number);
    const [year, month, day] = parts;
    if (year === undefined || month === undefined || day === undefined) {
        throw new Error(`Invalid date string: ${dateString}`);
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() - 1);

    return date.toISOString().slice(0, 10);
}