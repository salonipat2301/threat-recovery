export async function searchHistory(
    startTime: number,
    endTime: number
) {
    return await chrome.history.search({
        text: '',
        startTime,
        endTime,
        maxResults: 50,
    });
}