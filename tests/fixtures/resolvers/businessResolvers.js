export const businessLogicResolvers = {
    CustomerIsVIP: () => {
        return Math.random() > 0.8; // 20% chance of VIP
    },
    
    OrderExceedsThreshold: () => {
        const orderValue = Math.random() * 1000;
        return orderValue > 500; // Threshold at $500
    },
    
    InventoryAvailable: () => {
        return Math.random() > 0.1; // 90% chance of availability
    },
    
    PaymentProcessed: () => {
        return Math.random() > 0.05; // 95% chance of success
    },
    
    ShippingAddressValid: () => {
        return Math.random() > 0.02; // 98% chance of valid address
    }
};
