const express = require('express');
const cors = require('cors');
const { Client, LocalAuth, MessageMedia} = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let client;
let qrCodeData;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function createClient() {
  return new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });
}
let isClientReady = false;

// app.get('/login', async (req, res) => {
//   if (client && isClientReady) {
//     return res.status(400).json({ error: 'Session already active' });
//   }

//   client = await createClient();

//   client.on('qr', async (qr) => {
//     qrCodeData = await qrcode.toDataURL(qr);
//     res.send(`<img src="${qrCodeData}" alt="QR Code">`);
//   });

//   client.on('ready', () => {
//     console.log('Client is ready!');
//     isClientReady = true
//   });

//   client.on('authenticated', () => {
//     console.log('Client is authenticated!');
//   });

//   client.on('auth_failure', (msg) => {
//     console.error('Authentication failure', msg);
//   });

//   await client.initialize();
// });

// app.post('/sendMessageNew', async (req, res) => {
//     console.log("Is Client Ready:", isClientReady);
    
//     if (!client || !isClientReady) {
//         return res.status(400).json({ error: 'No active session' });
//     }
//     let { number, message, attachment=null } = req.body;

//     // Validate the input
//     if (!Array.isArray(number) || number.length === 0) {
//         return res.status(400).json({ error: 'Number must be an array and cannot be empty' });
//     }

//     try {
//         for (let i = 0; i < number.length; i++) {
//             const currentNumber = number[i];

//             // Prepare the media if attachment is provided
//             let media;
//             if (attachment) {
//                     media = MessageMedia.fromFilePath(attachment);
//             }

//             // Send the message
//             if (media) {
//                 console.log('sending media.....');
//                 await client.sendMessage(`${currentNumber}@c.us`, media, { caption: message });
//             } else {
//                 console.log('sending .....');
                
//                 await client.sendMessage(`${currentNumber}@c.us`, message);
//             }

//             console.log(`Message sent to ${currentNumber}`);

//             // Introduce a random delay between 5 to 10 seconds
//             const randomDelay = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000; // Between 5 and 10 seconds
//             await delay(randomDelay);
//         }

//         res.status(200).json({ success: true });
//     } catch (error) {
//         console.error("Error sending message:", error);
//         res.status(500).json({ error: error.message });
//     }
// });

app.get('/login', async (req, res) => {
    if (client && isClientReady) {
        return res.status(400).json({ error: 'Session already active' });
    }

    client = await createClient();

    // Use a flag to track if the QR code has already been sent
    let qrSent = false;

    client.on('qr', async (qr) => {
        if (!qrSent) {
            qrCodeData = await qrcode.toDataURL(qr);
            res.status(200).send(`<img src="${qrCodeData}" alt="QR Code">`);
            qrSent = true; // Mark as sent
        }
    });

    client.on('ready', () => {
        console.log('Client is ready!');
        isClientReady = true;
        
        // Check if QR was sent; if not, send a message indicating readiness
        if (!qrSent) {
            res.status(200).send('Client is ready and authenticated!');
            qrSent = true; // Ensure response is sent only once
        }
    });

    client.on('authenticated', () => {
        console.log('Client is authenticated!');
    });

    client.on('auth_failure', (msg) => {
        console.error('Authentication failure', msg);
        if (!qrSent) {
            res.status(500).json({ error: 'Authentication failed' });
            qrSent = true; // Mark as sent to avoid sending multiple responses
        }
    });

    // Initialize the client, ensuring no blocking occurs
    try {
        await client.initialize();
    } catch (error) {
        console.error('Error initializing client:', error);
        if (!qrSent) {
            res.status(500).json({ error: 'Failed to initialize client' });
            qrSent = true; // Mark as sent
        }
    }
});

app.post('/sendMessage', async (req, res) => {
    console.log("Is Client Ready:", isClientReady);
    if (!client || !isClientReady) {
        return res.status(400).json({ error: 'No active session' });
    }

    let { number, message, attachment = null } = req.body;
    // Validate the input
    if (!Array.isArray(number) || number.length === 0) {
        return res.status(400).json({ error: 'Number must be an array and cannot be empty' });
    }
    // Remove duplicates and validate numbers
    const uniqueNumbers = Array.from(new Set(number));
    const validNumbers = uniqueNumbers.filter(num => /^\d+$/.test(num)); // Only allow digits
    if (validNumbers.length === 0) {
        return res.status(400).json({ error: 'No valid numbers provided' });
    }
    // Send immediate response
    res.status(200).json({ success: true, message: 'Messages are being sent.' });

    // Function to send messages
    const sendMessages = async () => {
        try {
            for (let i = 0; i < validNumbers.length; i++) {
                const currentNumber = validNumbers[i];
                // Prepare the media if attachment is provided
                let media;
                if (attachment) {
                    media = MessageMedia.fromFilePath(attachment);
                }
                // Send the message
                if (media) {
                    console.log('sending media.....');
                    await client.sendMessage(`${currentNumber}@c.us`, media, { caption: message });
                } else {
                    console.log('sending .....');
                    await client.sendMessage(`${currentNumber}@c.us`, message);
                }

                console.log(`Message sent to ${currentNumber}`);
                // Introduce a random delay between 5 to 10 seconds
                const randomDelay = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000; // Between 5 and 10 seconds
                await delay(randomDelay);
            }
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    // Start sending messages
    sendMessages();
});

app.post('/sendGroupMessage', async (req, res) => {
  if (!client || !client.isReady) {
    return res.status(400).json({ error: 'No active session' });
  }

  const { groupId, message } = req.body;

  try {
    const chat = await client.getChatById(groupId);
    await chat.sendMessage(message);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/getGroups', async (req, res) => {
  if (!client || !isClientReady) {
    return res.status(400).json({ error: 'No active session' });
  }

  try {
    const chats = await client.getChats();
    const groups = chats
      .filter(chat => chat.isGroup)
      .map(group => ({
        id: group.id._serialized,
        name: group.name
      }));
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/status', (req, res) => {
  if (client && isClientReady) {
    res.json({ status: 'active' });
  } else if (qrCodeData) {
    res.json({ status: 'waiting for scan', qrCode: qrCodeData });
  } else {
    res.json({ status: 'inactive' });
  }
});

app.post('/logout', async (req, res) => {
  if (!client || !isClientReady) {
    return res.status(400).json({ error: 'No active session' });
  }

  try {
    await client.logout();
    client.destroy();
    client = null;
    qrCodeData = null;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`WhatsApp Web API listening at http://localhost:${port}`);
});