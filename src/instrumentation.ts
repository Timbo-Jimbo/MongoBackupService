
export async function register() 
{
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { bootstrap } = await import("@backend/backend-initialisation");
        await bootstrap();
    }
}