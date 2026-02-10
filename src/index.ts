import express from 'express';

const app = express();
const PORT = process.env.PORT || 3002;

interface Quote {
  id: number;
  text: string;
  author: string;
  category: string;
}

const quotes: Quote[] = [
  { id: 1, text: "The only way to do great work is to love what you do.", author: "Steve Jobs", category: "motivation" },
  { id: 2, text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs", category: "innovation" },
  { id: 3, text: "Stay hungry, stay foolish.", author: "Steve Jobs", category: "motivation" },
  { id: 4, text: "Code is like humor. When you have to explain it, it's bad.", author: "Cory House", category: "programming" },
  { id: 5, text: "First, solve the problem. Then, write the code.", author: "John Johnson", category: "programming" },
  { id: 6, text: "Simplicity is the soul of efficiency.", author: "Austin Freeman", category: "programming" },
  { id: 7, text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb", category: "motivation" },
  { id: 8, text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius", category: "persistence" },
  { id: 9, text: "Quality is not an act, it is a habit.", author: "Aristotle", category: "quality" },
  { id: 10, text: "The only impossible journey is the one you never begin.", author: "Tony Robbins", category: "motivation" },
];

app.use(express.json());

// Health endpoints
app.get('/health', (_, res) => res.json({ status: 'healthy' }));
app.get('/ready', (_, res) => res.json({ status: 'ready' }));

// Get a random quote
app.get('/api/quotes/random', (_, res) => {
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  res.json(randomQuote);
});

// Get all quotes
app.get('/api/quotes', (req, res) => {
  const category = req.query.category as string;
  
  if (category) {
    const filtered = quotes.filter(q => q.category.toLowerCase() === category.toLowerCase());
    return res.json({ quotes: filtered, total: filtered.length });
  }
  
  res.json({ quotes, total: quotes.length });
});

// Get quote by ID
app.get('/api/quotes/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const quote = quotes.find(q => q.id === id);
  
  if (!quote) {
    return res.status(404).json({ error: 'Quote not found' });
  }
  
  res.json(quote);
});

// Get available categories
app.get('/api/quotes/categories/list', (_, res) => {
  const categories = [...new Set(quotes.map(q => q.category))];
  res.json({ categories });
});

app.listen(PORT, () => {
  console.log(`utilities-quotes service running on port ${PORT}`);
});
