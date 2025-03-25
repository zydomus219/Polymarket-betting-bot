import { ClobClient, OrderType, Side } from '@polymarket/clob-client';
import { TradeData, TradeParams } from '../interfaces/tradeInterfaces';

const tradeExecutor = async (clobClient: ClobClient, data: TradeData, params: TradeParams) => {
    console.log('New trade executing process: ', data);

    const side = data.side ? Side.SELL : Side.BUY;
    const tokenID = data.tokenId;
    let price = data.side
        ? data.takerAmount / data.makerAmount
        : data.makerAmount / data.takerAmount;
    let size = data.side ? data.makerAmount / 1000000 + 0.01 : data.takerAmount / 1000000 + 0.01;

    if (size < 5 || size * price < 1) {
        console.log('Order size or value too small, skipping execution.');
        return;
    }

    const executeOrderWithRetry = async (
        price: number,
        size: number,
        retryLimit: number
    ): Promise<boolean> => {
        for (let attempt = 1; attempt <= retryLimit; attempt++) {
            console.log(`Attempt ${attempt} of ${retryLimit} for price: ${price}, size: ${size}`);
            const success = await executeOrder(price, size);
            if (success) return true;
        }
        console.error(`All ${retryLimit} attempts failed for price: ${price}, size: ${size}`);
        return false;
    };

    const executeOrder = async (price: number, size: number): Promise<boolean> => {
        try {
            const orderArgs = { side, tokenID, size, price };
            const order = await clobClient.createOrder(orderArgs);
            console.log('Created order:', order);

            const response = await clobClient.postOrder(order, OrderType.GTC);
            console.log('Order response:', response);

            if (!response.success) {
                console.error('Order posting failed.');
                return false;
            }

            const orderStatus = await clobClient.getOrder(response.orderID);
            if (orderStatus.original_size === orderStatus.size_matched) {
                console.log('Order completed successfully:', response.orderID);
                return true;
            }

            await clobClient.cancelOrder(response.orderID);
            console.log('Order partially filled and canceled:', response.orderID);
            return false;
        } catch (error) {
            console.error('Error during order execution:', error);
            return false;
        }
    };

    // Attempt initial order
    if (await executeOrderWithRetry(price, size, params.retryLimit)) return;
    await new Promise((resolve) => setTimeout(resolve, params.initialOrderTimeout * 1000));

    // Attempt second order with adjusted price
    price = data.side
        ? price - params.secondOrderIncrement / 100
        : price + params.secondOrderIncrement / 100;
    size = size - size * (params.secondOrderIncrement / 100);
    if (await executeOrderWithRetry(price, size, params.retryLimit)) return;
    await new Promise((resolve) => setTimeout(resolve, params.secondOrderTimeout * 1000));

    // Attempt final order with further adjusted price
    price = data.side
        ? price - params.finalOrderIncrement / 100
        : price + params.finalOrderIncrement / 100;
    size = size - size * (params.finalOrderIncrement / 100);
    if (await executeOrderWithRetry(price, size, params.retryLimit)) return;
    await new Promise((resolve) => setTimeout(resolve, params.finalOrderTimeout * 1000));

    console.log('Order failed to complete after all attempts.');
};

export default tradeExecutor;
