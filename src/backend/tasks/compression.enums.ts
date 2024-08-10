export enum BackupCompressionFormat
{
    Gzip = 'gzip',
    ZStandardFast = 'zstd-fast',
    ZStandardBalanced = 'zstd-balanced',
    ZStandardCompact = 'zstd-compact',
}

export enum BackupMode 
{
    Gzip = 'gzip',
    FasterBackup = 'faster',
    Balanced = 'balanced',
    SmallerBackup = 'smaller'
}