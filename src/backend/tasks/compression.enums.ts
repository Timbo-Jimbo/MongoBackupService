export enum BackupCompressionFormat
{
    None = 'None',
    ZStandard = 'ZStandard',
    Gzip = 'Gzip'
}

export enum BackupMode 
{
    FasterBackup = 'faster',
    Balanced = 'balanced',
    SmallerBackup = 'smaller'
}