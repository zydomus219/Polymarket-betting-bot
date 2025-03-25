export interface TradeData {
    blockNumber: number;
    transactionHash: string;
    tokenId: string;
    side: number;
    makerAmount: number;
    takerAmount: number;
}

export interface TradeParams {
    targetWallet: string;
    retryLimit: number;
    initialOrderTimeout: number;
    secondOrderIncrement: number;
    secondOrderTimeout: number;
    finalOrderIncrement: number;
    finalOrderTimeout: number;
}
