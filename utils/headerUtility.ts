let accessToken: string = "";

export function setToken(token: string) {

    accessToken = token;
}

export function getHeaders() {

    return {

        Authorization: `Bearer ${accessToken}`,

        'Content-Type': 'application/json',

        Accept: 'application/json'
    };
}

export function getFormHeaders() {
    return {
        'Content-Type': 'application/x-www-form-urlencoded'
    };
}