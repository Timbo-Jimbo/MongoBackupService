export enum BackupCompressionFormat
{
    Gzip = 'gzip',
    ZStandardFast = 'zstd-fast',
    ZStandardAdapative = 'zstd-adaptive',
    ZStandardCompact = 'zstd-compact',
}

export enum BackupMode 
{
    Gzip = 'gzip',
    FasterBackup = 'faster',
    Balanced = 'balanced',
    SmallerBackup = 'smaller'
}