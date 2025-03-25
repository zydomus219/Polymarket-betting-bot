import { BigNumber, ethers } from 'ethers';
import { EventEmitter } from 'events'; // Import EventEmitter
import { ENV } from '../config/env';
import { abi } from '../polymarket/abi';

const WSS_URL = ENV.WSS_URL;

class TradeMonitor extends EventEmitter {
    async start(TARGET_WALLET: string) {
        try {
            const wssProvider = new ethers.providers.WebSocketProvider(WSS_URL);
            const iface = new ethers.utils.Interface(abi);

            console.log('Listening for new blocks...');

            // Listen for new blocks
            wssProvider.on('block', async (blockNumber) => {
                try {
                    // console.log(`New block detected: ${blockNumber}`);
                    const block = await wssProvider.getBlockWithTransactions(blockNumber);

                    // Process each transaction in the block
                    for (const tx of block.transactions) {
                        let decodedData;
                        try {
                            decodedData = iface.parseTransaction({ data: tx.data });
                            // eslint-disable-next-line no-unused-vars
                        } catch (decodeError) {
                            continue; // Skip if decoding fails
                        }

                        if (decodedData.args[0].maker !== TARGET_WALLET) continue;

                        const receipt = await wssProvider.getTransactionReceipt(tx.hash);
                        if (receipt && receipt.status !== 1) continue;

                        const tokenId = BigNumber.from(decodedData.args[0].tokenId).toString();
                        const side = BigNumber.from(decodedData.args[0].side).toNumber();
                        const makerAmount = BigNumber.from(
                            decodedData.args[0].makerAmount
                        ).toNumber();
                        const takerAmount = BigNumber.from(
                            decodedData.args[0].takerAmount
                        ).toNumber();

                        // Emit an event with the decoded transaction data
                        this.emit('transaction', {
                            blockNumber,
                            transactionHash: tx.hash,
                            tokenId,
                            side,
                            makerAmount,
                            takerAmount,
                        });
                    }
                } catch (error) {
                    console.error(`Error processing block ${blockNumber}:`, error);
                }
            });

            // Handle WebSocket errors
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            wssProvider._websocket.on('error', (error: any) => {
                console.error('WebSocket error:', error);
                this.emit('error', error); // Emit an error event
            });

            // Handle WebSocket close events
            wssProvider._websocket.on('close', (code: number, reason: string) => {
                console.error(`WebSocket closed: Code ${code}, Reason: ${reason}`);
                this.emit('close', { code, reason }); // Emit a close event
            });
        } catch (error) {
            console.error('An error occurred:', error);
            this.emit('error', error); // Emit an error event
        }
    }
}

export default TradeMonitor;
