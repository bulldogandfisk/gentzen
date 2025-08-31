export const businessLogicResolvers = {
    CustomerIsVIP: () => {
        return Math.random() > 0.8;
    },
    
    OrderExceedsThreshold: () => {
        const orderValue = Math.random() * 1000;
        return orderValue > 500;
    },
    
    InventoryAvailable: () => {
        return Math.random() > 0.1;
    },
    
    PaymentProcessed: () => {
        return Math.random() > 0.05;
    },
    
    ShippingAddressValid: () => {
        return Math.random() > 0.02;
    }
};
