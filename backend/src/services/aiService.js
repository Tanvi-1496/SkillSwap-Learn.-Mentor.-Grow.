const AI_SERVICE_URL =
    process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

export async function generateProfileEmbedding(
    profileId,
    profileType,
    text
) {
    const response = await fetch(
        `${AI_SERVICE_URL}/embed`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                profile_id: profileId,
                profile_type: profileType,
                text
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
            `AI service error: ${errorText}`
        );
    }

    return await response.json();
}

export async function fetchRecommendations(studentId) {
    const response = await fetch(
        `${AI_SERVICE_URL}/recommendations/${encodeURIComponent(studentId)}`,
        {
            method: "GET",
            headers: {
                Accept: "application/json"
            }
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(
            `AI service error: ${errorText}`
        );
        error.status = response.status;
        throw error;
    }

    return await response.json();
}