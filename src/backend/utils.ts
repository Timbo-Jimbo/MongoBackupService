export function sqliteStringEnum<T extends Record<string,string>>(enumType: T): [string, ...string[]] {

    const valueStrings = Object.values(enumType).map(v => v.toString());
  
    if(valueStrings[0] === undefined)
      throw new Error("Enum must have at least one value");
  
    return valueStrings as [string, ...string[]];
}

export function censorMongoDbConnectionUri(url: string): string {
    // Regular expression to match MongoDB connection URL
    const regex = /^(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@(.+)$/;

    // Replace auth details with asterisks
    return url.replace(regex, (_, protocol, username, password, rest) => {
        return `${protocol}******@${rest}`;
    });
}
