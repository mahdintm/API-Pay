const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const app = express();
const dotenv = require('dotenv')
dotenv.config();
app.use(bodyParser.json());
const db = new sqlite3.Database(':memory:');
db.serialize(() => {
    db.run("CREATE TABLE invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, customer TEXT, amount REAL, description TEXT, status TEXT)");
});
app.post('/api/invoice', (req, res) => {
    const { customer, amount, description } = req.body;
    db.run("INSERT INTO invoices (customer, amount, description, status) VALUES (?, ?, ?, ?)", [customer, amount, description, 'pending'], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID });
    });
});
app.get('/api/invoices', (req, res) => {
    db.all("SELECT * FROM invoices", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});
app.post('/api/pay/:id', (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM invoices WHERE id = ?", [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        axios.post(process.env.URLPAY, {
                amount: row.amount,
                description: row.description
            })
            .then(response => {
                if (response.data.success) {
                    db.run("UPDATE invoices SET status = ? WHERE id = ?", ['paid', id], (err) => {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }
                        res.json({ message: 'Payment successful', invoice: row });
                    });
                } else {
                    res.status(400).json({ error: 'Payment failed' });
                }
            })
            .catch(error => {
                res.status(500).json({ error: 'Payment gateway error' });
            });
    });
});
app.listen(port, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});