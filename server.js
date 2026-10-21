const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3000;
const TARGET_URL = 'https://j.zifra42.ru';

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.static(__dirname));

let cookies = {};

function cookiesToString() {
    return Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
}

function updateCookies(setCookieHeader) {
    if (!setCookieHeader) return;
    const list = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    list.forEach(raw => {
        const [pair] = raw.split(';');
        const [name, ...rest] = pair.split('=');
        const value = rest.join('=');
        if (name && value) {
            cookies[name.trim()] = value.trim();
        }
    });
}

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
    'Referer': 'https://j.zifra42.ru/dist/',
    'Origin': 'https://j.zifra42.ru'
};

app.post('/api/login', async (req, res) => {
    console.log('\n============================================');
    console.log('🔐 POST /api/login');
    console.log('============================================');
    console.log('📤 Отправляем на:', `${TARGET_URL}/dist/api/1c/auth.php`);
    console.log('📤 Тело:', JSON.stringify(req.body));

    try {
        const response = await axios.post(`${TARGET_URL}/dist/api/1c/auth.php`, req.body, {
            headers: {
                ...BROWSER_HEADERS,
                'Content-Type': 'application/json;charset=utf-8'
            },
            validateStatus: () => true
        });

        console.log('📥 Статус ответа:', response.status);
        console.log('📥 Set-Cookie от сервера:', response.headers['set-cookie'] || '(нет!)');
        console.log('📥 Тело ответа (первые 200 символов):', JSON.stringify(response.data).substring(0, 200));

        updateCookies(response.headers['set-cookie']);
        console.log('🍪 Куки после обновления:', cookies);
        console.log('🍪 Строка для Cookie заголовка:', cookiesToString());

        if (response.data && response.data.status === 'success') {
            console.log('✅ ЛОГИН УСПЕШЕН');
            res.json(response.data);
        } else {
            console.log('❌ ЛОГИН НЕ УДАЛСЯ');
            res.status(401).json({ status: 'error', message: response.data.message || 'Неверный логин или пароль' });
        }
    } catch (error) {
        console.error('❌ ИСКЛЮЧЕНИЕ ПРИ ЛОГИНЕ:', error.message);
        res.status(500).json({ status: 'error', message: 'Ошибка сервера' });
    }
});

app.get('/api/courses', async (req, res) => {
    console.log('\n============================================');
    console.log('📚 GET /api/courses');
    console.log('============================================');
    console.log('🍪 Текущие куки:', cookies);
    console.log('🍪 Строка Cookie:', cookiesToString() || '(пусто!)');

    if (Object.keys(cookies).length === 0) {
        console.log('⛔ Кук нет — отдаю 401');
        return res.status(401).json({ error: 'Не авторизован. Сначала залогиньтесь.' });
    }

    try {
        const url = `${TARGET_URL}/dist/api/courses/catalog.php`;
        const headers = {
            ...BROWSER_HEADERS,
            'Cookie': cookiesToString()
        };

        console.log('📤 Отправляем на:', url);
        console.log('📤 Заголовок Cookie:', headers['Cookie']);
        console.log('📤 Полные заголовки:', JSON.stringify(headers, null, 2));

        const response = await axios.get(url, {
            headers,
            validateStatus: () => true
        });

        console.log('📥 Статус ответа:', response.status);
        console.log('📥 Set-Cookie от сервера:', response.headers['set-cookie'] || '(нет)');
        console.log('📥 Тело ответа (первые 300 символов):', JSON.stringify(response.data).substring(0, 300));

        if (response.headers['set-cookie']) {
            updateCookies(response.headers['set-cookie']);
            console.log('🍪 Куки обновлены сервером:', cookies);
        }

        if (response.data && response.data.error) {
            console.log('❌ СЕРВЕР СКАЗАЛ ОШИБКУ:', response.data.error);
            return res.status(401).json({ 
                error: 'Сессия недействительна', 
                serverResponse: response.data 
            });
        }

        if (!response.data || !response.data.covers) {
            console.log('⚠️ Странный ответ: нет поля "covers"');
        } else {
            console.log(`✅ Курсов получено: ${response.data.covers.length}`);
        }

        res.json(response.data);
    } catch (error) {
        console.error('❌ ИСКЛЮЧЕНИЕ:', error.message);
        res.status(500).json({ error: 'Ошибка при загрузке списка курсов' });
    }
});

app.get('/api/course/:id', async (req, res) => {
    console.log('\n============================================');
    console.log(`📖 GET /api/course/${req.params.id}`);
    console.log('============================================');
    console.log('🍪 Куки для запроса:', cookiesToString());

    if (Object.keys(cookies).length === 0) {
        return res.status(401).json({ error: 'Не авторизован. Сначала залогиньтесь.' });
    }

    try {
        const url = `${TARGET_URL}/dist/api/courses/catalog.php?id=${req.params.id}`;
        console.log('📤 Отправляем на:', url);

        const response = await axios.get(url, {
            headers: {
                ...BROWSER_HEADERS,
                'Cookie': cookiesToString()
            },
            validateStatus: () => true
        });

        console.log('📥 Статус:', response.status);
        console.log('📥 Set-Cookie:', response.headers['set-cookie'] || '(нет)');

        if (response.headers['set-cookie']) {
            updateCookies(response.headers['set-cookie']);
        }

        if (response.data && response.data.error) {
            console.log('❌ Сервер отверг:', response.data);
            return res.status(401).json({ error: 'Сессия недействительна', serverResponse: response.data });
        }

        console.log('✅ Детали курса получены');
        res.json(response.data);
    } catch (error) {
        console.error('❌ ИСКЛЮЧЕНИЕ:', error.message);
        res.status(500).json({ error: 'Ошибка при загрузке деталей курса' });
    }
});

app.get('/api/status', (req, res) => {
    res.json({
        isAuthenticated: Object.keys(cookies).length > 0,
        cookies: cookies,
        cookieString: cookiesToString()
    });
});

app.listen(PORT, () => {
    console.log(`\n✅ Сервер запущен: http://localhost:${PORT}\n`);
});