export default {
    apiKey: process.env.API_KEY || "test",
    mockResponseDelay: parseInt(process.env.MOCK_RESPONSE_DELAY || "0"),
}