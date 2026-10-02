export class DividendService {
    calculate(input: {
        eligibleQuantity: number;
        amountPerUnit: number;
    }): number {
        return input.eligibleQuantity * input.amountPerUnit;
    }
}