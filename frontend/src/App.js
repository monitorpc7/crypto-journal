import React, { useState, useEffect, createContext, useContext } from "react";
import "./App.css";
import axios from "axios";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";
import { Badge } from "./components/ui/badge";
import { Calendar } from "./components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { Switch } from "./components/ui/switch";
import { CalendarIcon, Search, Filter, Plus, Edit, Trash2, TrendingUp, TrendingDown, BarChart3, Moon, Sun, Bitcoin, DollarSign, Percent, Activity } from "lucide-react";
import { format } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Theme Context
const ThemeContext = createContext();

const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('darkMode');
    if (savedTheme) {
      setDarkMode(JSON.parse(savedTheme));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleTheme = () => setDarkMode(!darkMode);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Price Dashboard Component
const PriceDashboard = () => {
  const [tickers, setTickers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { darkMode } = useTheme();

  const fetchPrices = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/mexc/popular-pairs`);
      setTickers(response.data.tickers || []);
    } catch (error) {
      console.error("Error fetching prices:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  const getPriceChangeColor = (change) => {
    if (change > 0) return "text-green-500";
    if (change < 0) return "text-red-500";
    return "text-gray-500";
  };

  const getPriceChangeBg = (change) => {
    if (change > 0) return "bg-green-100 dark:bg-green-900/20";
    if (change < 0) return "bg-red-100 dark:bg-red-900/20";
    return "bg-gray-100 dark:bg-gray-800";
  };

  return (
    <Card className={`mb-8 ${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-slate-200'} backdrop-blur-sm shadow-lg`}>
      <CardHeader>
        <CardTitle className={`flex items-center ${darkMode ? 'text-white' : 'text-slate-900'}`}>
          <Activity className="w-5 h-5 mr-2" />
          Live Crypto Prices (MEXC)
        </CardTitle>
        <CardDescription className={darkMode ? 'text-gray-400' : 'text-slate-600'}>
          24-hour price changes for popular cryptocurrency pairs
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="spinner"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {tickers.map((ticker, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getPriceChangeBg(ticker.priceChangePercent)} ${darkMode ? 'border-gray-600' : 'border-slate-200'} transition-all duration-200 hover:scale-105`}
              >
                <div className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  {ticker.symbol}
                </div>
                <div className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  ${parseFloat(ticker.lastPrice).toLocaleString()}
                </div>
                <div className={`text-sm ${getPriceChangeColor(ticker.priceChangePercent)}`}>
                  {ticker.priceChangePercent > 0 ? '+' : ''}{parseFloat(ticker.priceChangePercent).toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const CryptoTradingJournal = () => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  
  const { darkMode, toggleTheme } = useTheme();
  
  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [formData, setFormData] = useState({
    pair: "",
    entry_price: "",
    exit_price: "",
    usd_amount: "",
    trade_date: new Date(),
    pnl: "",
    strategy: "",
    trade_type: "Long",
    stop_loss: "",
    take_profit: "",
    notes: "",
    image_data: ""
  });
  
  // Filter states
  const [filters, setFilters] = useState({
    search: "",
    strategy: "",
    trade_type: "",
    date_from: null,
    date_to: null,
    pnl_min: "",
    pnl_max: ""
  });
  
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [stats, setStats] = useState({});

  // Popular crypto pairs for suggestions
  const popularPairs = ["BTC/USDT", "ETH/USDT", "BNB/USDT", "ADA/USDT", "SOL/USDT", "MATIC/USDT", "DOT/USDT", "AVAX/USDT"];

  // Fetch trades
  const fetchTrades = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sort_by: sortBy,
        sort_order: sortOrder
      });

      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "") {
          if (key === "date_from" || key === "date_to") {
            params.append(key, format(value, "yyyy-MM-dd"));
          } else {
            params.append(key, value);
          }
        }
      });

      const response = await axios.get(`${API}/trades?${params}`);
      setTrades(response.data.trades);
      setPagination({
        page: response.data.page,
        limit: response.data.limit,
        total: response.data.total,
        totalPages: response.data.total_pages
      });
    } catch (error) {
      console.error("Error fetching trades:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/trades/stats/summary`);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  useEffect(() => {
    fetchTrades();
    fetchStats();
  }, [pagination.page, sortBy, sortOrder, filters]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const submitData = {
        ...formData,
        entry_price: parseFloat(formData.entry_price),
        exit_price: formData.exit_price ? parseFloat(formData.exit_price) : null,
        usd_amount: parseFloat(formData.usd_amount),
        trade_date: format(formData.trade_date, "yyyy-MM-dd"),
        pnl: formData.pnl ? parseFloat(formData.pnl) : null,
        stop_loss: formData.stop_loss ? parseFloat(formData.stop_loss) : null,
        take_profit: formData.take_profit ? parseFloat(formData.take_profit) : null,
      };

      if (editingTrade) {
        await axios.put(`${API}/trades/${editingTrade.id}`, submitData);
      } else {
        await axios.post(`${API}/trades`, submitData);
      }
      
      resetForm();
      setIsModalOpen(false);
      fetchTrades();
      fetchStats();
    } catch (error) {
      console.error("Error saving trade:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image_data: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      pair: "",
      entry_price: "",
      exit_price: "",
      usd_amount: "",
      trade_date: new Date(),
      pnl: "",
      strategy: "",
      trade_type: "Long",
      stop_loss: "",
      take_profit: "",
      notes: "",
      image_data: ""
    });
    setEditingTrade(null);
  };

  // Handle edit
  const handleEdit = (trade) => {
    setEditingTrade(trade);
    setFormData({
      pair: trade.pair,
      entry_price: trade.entry_price.toString(),
      exit_price: trade.exit_price ? trade.exit_price.toString() : "",
      usd_amount: trade.usd_amount.toString(),
      trade_date: new Date(trade.trade_date),
      pnl: trade.pnl ? trade.pnl.toString() : "",
      strategy: trade.strategy,
      trade_type: trade.trade_type,
      stop_loss: trade.stop_loss ? trade.stop_loss.toString() : "",
      take_profit: trade.take_profit ? trade.take_profit.toString() : "",
      notes: trade.notes || "",
      image_data: trade.image_data || ""
    });
    setIsModalOpen(true);
  };

  // Handle delete
  const handleDelete = async (tradeId) => {
    if (window.confirm("Are you sure you want to delete this trade?")) {
      try {
        await axios.delete(`${API}/trades/${tradeId}`);
        fetchTrades();
        fetchStats();
      } catch (error) {
        console.error("Error deleting trade:", error);
      }
    }
  };

  const getPnlColor = (pnl) => {
    if (pnl > 0) return "text-green-600 dark:text-green-400";
    if (pnl < 0) return "text-red-600 dark:text-red-400";
    return "text-gray-600 dark:text-gray-400";
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gradient-to-br from-gray-900 to-blue-900' : 'bg-gradient-to-br from-slate-50 to-blue-50'}`}>
      {/* Header */}
      <div className={`${darkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-slate-200'} backdrop-blur-md border-b sticky top-0 z-40`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className={`text-3xl font-bold flex items-center ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  <Bitcoin className="w-8 h-8 mr-3 text-orange-500" />
                  Crypto Trading Journal
                </h1>
                <p className={`mt-1 ${darkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                  Track and analyze your cryptocurrency trading performance
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Theme Toggle */}
              <div className="flex items-center space-x-2">
                <Sun className="w-4 h-4" />
                <Switch checked={darkMode} onCheckedChange={toggleTheme} />
                <Moon className="w-4 h-4" />
              </div>
              
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={resetForm}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Trade
                  </Button>
                </DialogTrigger>
                
                {/* Add/Edit Trade Modal */}
                <DialogContent className={`max-w-2xl max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>
                  <DialogHeader>
                    <DialogTitle className={darkMode ? 'text-white' : 'text-slate-900'}>
                      {editingTrade ? 'Edit Crypto Trade' : 'Add New Crypto Trade'}
                    </DialogTitle>
                    <DialogDescription className={darkMode ? 'text-gray-400' : 'text-slate-600'}>
                      {editingTrade ? 'Update your trade details below.' : 'Enter the details of your crypto trade below.'}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="pair" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Crypto Pair *</Label>
                        <Input
                          id="pair"
                          placeholder="e.g., BTC/USDT"
                          className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                          value={formData.pair}
                          onChange={(e) => setFormData(prev => ({ ...prev, pair: e.target.value.toUpperCase() }))}
                          list="popular-pairs"
                          required
                        />
                        <datalist id="popular-pairs">
                          {popularPairs.map(pair => (
                            <option key={pair} value={pair} />
                          ))}
                        </datalist>
                      </div>
                      
                      <div>
                        <Label htmlFor="trade_type" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Trade Type *</Label>
                        <Select value={formData.trade_type} onValueChange={(value) => setFormData(prev => ({ ...prev, trade_type: value }))}>
                          <SelectTrigger className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Long">Long</SelectItem>
                            <SelectItem value="Short">Short</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="entry_price" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Entry Price (USD) *</Label>
                        <Input
                          id="entry_price"
                          type="number"
                          step="0.00000001"
                          placeholder="0.00000000"
                          className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                          value={formData.entry_price}
                          onChange={(e) => setFormData(prev => ({ ...prev, entry_price: e.target.value }))}
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="exit_price" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Exit Price (USD)</Label>
                        <Input
                          id="exit_price"
                          type="number"
                          step="0.00000001"
                          placeholder="0.00000000"
                          className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                          value={formData.exit_price}
                          onChange={(e) => setFormData(prev => ({ ...prev, exit_price: e.target.value }))}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="usd_amount" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>USD Amount Invested *</Label>
                        <Input
                          id="usd_amount"
                          type="number"
                          step="0.01"
                          placeholder="100.00"
                          className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                          value={formData.usd_amount}
                          onChange={(e) => setFormData(prev => ({ ...prev, usd_amount: e.target.value }))}
                          required
                        />
                        <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                          Quantity will be calculated automatically
                        </p>
                      </div>
                      
                      <div>
                        <Label className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Trade Date *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={`w-full justify-start text-left font-normal ${darkMode ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600' : 'border-slate-300 hover:bg-slate-50'}`}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.trade_date ? format(formData.trade_date, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className={`w-auto p-0 ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-slate-200'}`} align="start">
                            <Calendar
                              mode="single"
                              selected={formData.trade_date}
                              onSelect={(date) => setFormData(prev => ({ ...prev, trade_date: date }))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      
                      <div>
                        <Label htmlFor="strategy" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Strategy *</Label>
                        <Input
                          id="strategy"
                          placeholder="e.g., DCA, HODLing, Swing Trading"
                          className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                          value={formData.strategy}
                          onChange={(e) => setFormData(prev => ({ ...prev, strategy: e.target.value }))}
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="pnl" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>P&L (USD)</Label>
                        <Input
                          id="pnl"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                          value={formData.pnl}
                          onChange={(e) => setFormData(prev => ({ ...prev, pnl: e.target.value }))}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="stop_loss" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Stop Loss (USD)</Label>
                        <Input
                          id="stop_loss"
                          type="number"
                          step="0.00000001"
                          placeholder="0.00000000"
                          className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                          value={formData.stop_loss}
                          onChange={(e) => setFormData(prev => ({ ...prev, stop_loss: e.target.value }))}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="take_profit" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Take Profit (USD)</Label>
                        <Input
                          id="take_profit"
                          type="number"
                          step="0.00000001"
                          placeholder="0.00000000"
                          className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                          value={formData.take_profit}
                          onChange={(e) => setFormData(prev => ({ ...prev, take_profit: e.target.value }))}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="notes" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Notes</Label>
                      <Textarea
                        id="notes"
                        placeholder="Add any additional notes about this trade..."
                        className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="image" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>P&L Chart (Optional)</Label>
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                        onChange={handleImageUpload}
                      />
                      {formData.image_data && (
                        <div className="mt-2">
                          <img src={formData.image_data} alt="Trade chart" className={`max-w-xs h-auto rounded-lg border ${darkMode ? 'border-gray-600' : 'border-slate-200'}`} />
                        </div>
                      )}
                    </div>
                    
                    <div className={`flex justify-end space-x-3 pt-4 border-t ${darkMode ? 'border-gray-600' : 'border-slate-200'}`}>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          resetForm();
                          setIsModalOpen(false);
                        }}
                        className={darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={loading}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                      >
                        {loading ? 'Saving...' : (editingTrade ? 'Update Trade' : 'Add Trade')}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Price Dashboard */}
        <PriceDashboard />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card className={`${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-slate-200'} backdrop-blur-sm shadow-lg`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-slate-600'}`}>Total Trades</CardTitle>
              <BarChart3 className={`h-4 w-4 ${darkMode ? 'text-gray-400' : 'text-slate-600'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{stats.total_trades || 0}</div>
            </CardContent>
          </Card>
          
          <Card className={`${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-slate-200'} backdrop-blur-sm shadow-lg`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-slate-600'}`}>Total P&L</CardTitle>
              {(stats.total_pnl || 0) >= 0 ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getPnlColor(stats.total_pnl || 0)}`}>
                ${(stats.total_pnl || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          
          <Card className={`${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-slate-200'} backdrop-blur-sm shadow-lg`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-slate-600'}`}>Total Invested</CardTitle>
              <DollarSign className={`h-4 w-4 ${darkMode ? 'text-gray-400' : 'text-slate-600'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                ${(stats.total_invested || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          
          <Card className={`${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-slate-200'} backdrop-blur-sm shadow-lg`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-slate-600'}`}>Win Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{stats.win_rate || 0}%</div>
            </CardContent>
          </Card>
          
          <Card className={`${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-slate-200'} backdrop-blur-sm shadow-lg`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-slate-600'}`}>ROI</CardTitle>
              <Percent className={`h-4 w-4 ${darkMode ? 'text-gray-400' : 'text-slate-600'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getPnlColor(stats.roi || 0)}`}>
                {(stats.roi || 0).toFixed(2)}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className={`mb-8 ${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-slate-200'} backdrop-blur-sm shadow-lg`}>
          <CardHeader>
            <CardTitle className={`flex items-center ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              <Filter className="w-5 h-5 mr-2" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Search Crypto Pair</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="search"
                    placeholder="e.g., BTC/USDT, ETH/USDT"
                    className={`pl-9 ${darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}`}
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="strategy-filter" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Strategy</Label>
                <Input
                  id="strategy-filter"
                  placeholder="e.g., DCA, Swing Trading"
                  className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                  value={filters.strategy}
                  onChange={(e) => setFilters(prev => ({ ...prev, strategy: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="trade-type-filter" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Trade Type</Label>
                <Select value={filters.trade_type} onValueChange={(value) => setFilters(prev => ({ ...prev, trade_type: value }))}>
                  <SelectTrigger className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Long">Long</SelectItem>
                    <SelectItem value="Short">Short</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Sort By</Label>
                <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                  const [field, order] = value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}>
                  <SelectTrigger className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at-desc">Latest First</SelectItem>
                    <SelectItem value="created_at-asc">Oldest First</SelectItem>
                    <SelectItem value="pnl-desc">Highest P&L</SelectItem>
                    <SelectItem value="pnl-asc">Lowest P&L</SelectItem>
                    <SelectItem value="pair-asc">Pair A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trades Table */}
        <Card className={`${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-slate-200'} backdrop-blur-sm shadow-lg`}>
          <CardHeader>
            <CardTitle className={darkMode ? 'text-white' : 'text-slate-900'}>Recent Trades</CardTitle>
            <CardDescription className={darkMode ? 'text-gray-400' : 'text-slate-600'}>
              {pagination.total} total trades found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`rounded-md border overflow-hidden ${darkMode ? 'border-gray-600' : 'border-slate-200'}`}>
              <Table>
                <TableHeader className={darkMode ? 'bg-gray-700/80' : 'bg-slate-50/80'}>
                  <TableRow>
                    <TableHead className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Crypto Pair</TableHead>
                    <TableHead className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Type</TableHead>
                    <TableHead className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Entry Price</TableHead>
                    <TableHead className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Exit Price</TableHead>
                    <TableHead className={darkMode ? 'text-gray-300' : 'text-slate-700'}>USD Amount</TableHead>
                    <TableHead className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Quantity</TableHead>
                    <TableHead className={darkMode ? 'text-gray-300' : 'text-slate-700'}>P&L</TableHead>
                    <TableHead className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Strategy</TableHead>
                    <TableHead className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Date</TableHead>
                    <TableHead className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                        Loading trades...
                      </TableCell>
                    </TableRow>
                  ) : trades.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                        No trades found. Start by adding your first crypto trade!
                      </TableCell>
                    </TableRow>
                  ) : (
                    trades.map((trade) => (
                      <TableRow key={trade.id} className={`${darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-slate-50/50'}`}>
                        <TableCell className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{trade.pair}</TableCell>
                        <TableCell>
                          <Badge variant={trade.trade_type === 'Long' ? 'default' : 'secondary'}>
                            {trade.trade_type}
                          </Badge>
                        </TableCell>
                        <TableCell className={darkMode ? 'text-gray-300' : 'text-slate-700'}>${trade.entry_price}</TableCell>
                        <TableCell className={darkMode ? 'text-gray-300' : 'text-slate-700'}>
                          {trade.exit_price ? `$${trade.exit_price}` : '-'}
                        </TableCell>
                        <TableCell className={darkMode ? 'text-gray-300' : 'text-slate-700'}>${trade.usd_amount}</TableCell>
                        <TableCell className={darkMode ? 'text-gray-300' : 'text-slate-700'}>{trade.quantity.toFixed(8)}</TableCell>
                        <TableCell className={getPnlColor(trade.pnl)}>
                          {trade.pnl ? `$${trade.pnl.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className={darkMode ? 'text-gray-300' : 'text-slate-700'}>{trade.strategy}</TableCell>
                        <TableCell className={darkMode ? 'text-gray-300' : 'text-slate-700'}>
                          {format(new Date(trade.trade_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(trade)}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(trade.id)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-between items-center mt-6">
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} trades
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    disabled={pagination.page === 1}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    className={darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    className={darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Trade Modal */}
      <DialogContent className={`max-w-2xl max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>
        <DialogHeader>
          <DialogTitle className={darkMode ? 'text-white' : 'text-slate-900'}>
            {editingTrade ? 'Edit Crypto Trade' : 'Add New Crypto Trade'}
          </DialogTitle>
          <DialogDescription className={darkMode ? 'text-gray-400' : 'text-slate-600'}>
            {editingTrade ? 'Update your trade details below.' : 'Enter the details of your crypto trade below.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pair" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Crypto Pair *</Label>
              <Input
                id="pair"
                placeholder="e.g., BTC/USDT"
                className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                value={formData.pair}
                onChange={(e) => setFormData(prev => ({ ...prev, pair: e.target.value.toUpperCase() }))}
                list="popular-pairs"
                required
              />
              <datalist id="popular-pairs">
                {popularPairs.map(pair => (
                  <option key={pair} value={pair} />
                ))}
              </datalist>
            </div>
            
            <div>
              <Label htmlFor="trade_type" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Trade Type *</Label>
              <Select value={formData.trade_type} onValueChange={(value) => setFormData(prev => ({ ...prev, trade_type: value }))}>
                <SelectTrigger className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Long">Long</SelectItem>
                  <SelectItem value="Short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="entry_price" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Entry Price (USD) *</Label>
              <Input
                id="entry_price"
                type="number"
                step="0.00000001"
                placeholder="0.00000000"
                className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                value={formData.entry_price}
                onChange={(e) => setFormData(prev => ({ ...prev, entry_price: e.target.value }))}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="exit_price" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Exit Price (USD)</Label>
              <Input
                id="exit_price"
                type="number"
                step="0.00000001"
                placeholder="0.00000000"
                className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                value={formData.exit_price}
                onChange={(e) => setFormData(prev => ({ ...prev, exit_price: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="usd_amount" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>USD Amount Invested *</Label>
              <Input
                id="usd_amount"
                type="number"
                step="0.01"
                placeholder="100.00"
                className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                value={formData.usd_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, usd_amount: e.target.value }))}
                required
              />
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                Quantity will be calculated automatically
              </p>
            </div>
            
            <div>
              <Label className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Trade Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start text-left font-normal ${darkMode ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600' : 'border-slate-300 hover:bg-slate-50'}`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.trade_date ? format(formData.trade_date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className={`w-auto p-0 ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-slate-200'}`} align="start">
                  <Calendar
                    mode="single"
                    selected={formData.trade_date}
                    onSelect={(date) => setFormData(prev => ({ ...prev, trade_date: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div>
              <Label htmlFor="strategy" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Strategy *</Label>
              <Input
                id="strategy"
                placeholder="e.g., DCA, HODLing, Swing Trading"
                className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                value={formData.strategy}
                onChange={(e) => setFormData(prev => ({ ...prev, strategy: e.target.value }))}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="pnl" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>P&L (USD)</Label>
              <Input
                id="pnl"
                type="number"
                step="0.01"
                placeholder="0.00"
                className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                value={formData.pnl}
                onChange={(e) => setFormData(prev => ({ ...prev, pnl: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="stop_loss" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Stop Loss (USD)</Label>
              <Input
                id="stop_loss"
                type="number"
                step="0.00000001"
                placeholder="0.00000000"
                className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                value={formData.stop_loss}
                onChange={(e) => setFormData(prev => ({ ...prev, stop_loss: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="take_profit" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Take Profit (USD)</Label>
              <Input
                id="take_profit"
                type="number"
                step="0.00000001"
                placeholder="0.00000000"
                className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
                value={formData.take_profit}
                onChange={(e) => setFormData(prev => ({ ...prev, take_profit: e.target.value }))}
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="notes" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes about this trade..."
              className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          
          <div>
            <Label htmlFor="image" className={darkMode ? 'text-gray-300' : 'text-slate-700'}>P&L Chart (Optional)</Label>
            <Input
              id="image"
              type="file"
              accept="image/*"
              className={darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-slate-300 focus:border-blue-500'}
              onChange={handleImageUpload}
            />
            {formData.image_data && (
              <div className="mt-2">
                <img src={formData.image_data} alt="Trade chart" className={`max-w-xs h-auto rounded-lg border ${darkMode ? 'border-gray-600' : 'border-slate-200'}`} />
              </div>
            )}
          </div>
          
          <div className={`flex justify-end space-x-3 pt-4 border-t ${darkMode ? 'border-gray-600' : 'border-slate-200'}`}>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                setIsModalOpen(false);
              }}
              className={darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
            >
              {loading ? 'Saving...' : (editingTrade ? 'Update Trade' : 'Add Trade')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <CryptoTradingJournal />
      </div>
    </ThemeProvider>
  );
}

export default App;