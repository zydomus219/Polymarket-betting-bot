import { ClobClient, OrderType, Side } from '@polymarket/clob-client';
import { TradeData, TradeParams } from '../interfaces/tradeInterfaces';
import getMyBalance from '../utils/getMyBalance';

const tradeExecutor = async (clobClient: ClobClient, data: TradeData, params: TradeParams) => {
    console.log('\n------------------------------------------\n New trade executing process: ', data);

    const side = data.side ? Side.SELL : Side.BUY;
    const tokenID = data.tokenId;
    let price = data.side
        ? data.takerAmount / data.makerAmount
        : data.makerAmount / data.takerAmount;
    let size = data.side ? data.makerAmount / 1000000 * params.copyRatio + 0.01 : data.takerAmount / 1000000 * params.copyRatio + 0.01;

    if (size < 5) {
        size = 5;
        console.log('size too small, reset size as 5');
    }
    if (size * price < 1) {
        // console.log('value too small, skipping execution.');
        size = 1 / price + 0.01;
        console.log(`reset size as ${size}=1/${price}`);
        // return;    
    }

    const executeOrderWithRetry = async (
        price: number,
        size: number,
        timeout: number
    ): Promise<boolean> => {
        for (let attempt = 1; attempt <= params.retryLimit; attempt++) {
            console.log(
                `✅ Attempt ${attempt} of ${params.retryLimit} for price: ${price}, size: ${size}`
            );

            const success = await executeOrder(price, size, timeout);
            if (success) return true;
        }
        console.error(
            `All ${params.retryLimit} attempts failed for price: ${price}, size: ${size} 🔥 `
        );
        return false;
    };

    const executeOrder = async (price: number, size: number, timeout: number): Promise<boolean> => {
        try {
            const orderArgs = { side, tokenID, size, price };
            const order = await clobClient.createOrder(orderArgs);
            console.log('Created order 🎉:', order);

            const response = await clobClient.postOrder(order, OrderType.GTC);
            console.log('Order response:', response);

            if (!response.success) {
                console.error('Order posting failed.');
                return false;
            }

            await new Promise((resolve) => setTimeout(resolve, timeout * 1000));
            const orderStatus = await clobClient.getOrder(response.orderID);
            if (orderStatus.original_size === orderStatus.size_matched) {
                console.log('Order completed successfully 🎉:', response.orderID);
                return true;
            }

            await new Promise((resolve) => setTimeout(resolve, timeout * 1000));
            await clobClient.cancelOrder(response.orderID);
            console.log('Order partially filled and canceled ❌:', response.orderID);
            return false;
        } catch (error) {
            console.error('Error during order execution ❗:', error);
            return false;
        }
    };

    // Attempt initial order
    if (await executeOrderWithRetry(price, size, params.initialOrderTimeout)) return;

    // Attempt second order with adjusted price
    price = data.side
        ? price - params.secondOrderIncrement / 100
        : price + params.secondOrderIncrement / 100;
    size = size - size * (params.secondOrderIncrement / 100);
    if (await executeOrderWithRetry(price, size, params.secondOrderTimeout)) return;

    // Attempt final order with further adjusted price
    price = data.side
        ? price - params.finalOrderIncrement / 100
        : price + params.finalOrderIncrement / 100;
    size = size - size * (params.finalOrderIncrement / 100);
    if (await executeOrderWithRetry(price, size, params.finalOrderTimeout)) return;

    console.log('Order failed to complete after all attempts.');
};

export default tradeExecutor;