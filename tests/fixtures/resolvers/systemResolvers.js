export const systemMonitoringResolvers = {
    SystemHealthy: () => {
        const cpuUsage = Math.random() * 100;
        return cpuUsage < 80; // Healthy if CPU < 80%
    },
    
    DatabaseConnected: () => {
        return Math.random() > 0.1; // 90% chance of connection
    },
    
    BackupCompleted: () => {
        const lastBackup = new Date() - (Math.random() * 24 * 60 * 60 * 1000);
        return lastBackup < (6 * 60 * 60 * 1000); // Within 6 hours
    },
    
    SecurityScanPassed: () => {
        return Math.random() > 0.05; // 95% chance of passing
    },
    
    DiskSpaceAvailable: () => {
        const usage = Math.random() * 100;
        return usage < 90; // Available if usage < 90%
    }
};
