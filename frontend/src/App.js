import React, { useState, useEffect } from "react";
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
import { CalendarIcon, Search, Filter, Plus, Edit, Trash2, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { format } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TradeJournal = () => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  
  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [formData, setFormData] = useState({
    symbol: "",
    entry_price: "",
    exit_price: "",
    quantity: "",
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
        quantity: parseInt(formData.quantity),
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
      symbol: "",
      entry_price: "",
      exit_price: "",
      quantity: "",
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
      symbol: trade.symbol,
      entry_price: trade.entry_price.toString(),
      exit_price: trade.exit_price ? trade.exit_price.toString() : "",
      quantity: trade.quantity.toString(),
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
    if (pnl > 0) return "text-green-600";
    if (pnl < 0) return "text-red-600";
    return "text-gray-600";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Trading Journal</h1>
              <p className="text-slate-600 mt-1">Track and analyze your trading performance</p>
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
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-slate-200">
                <DialogHeader>
                  <DialogTitle className="text-slate-900">
                    {editingTrade ? 'Edit Trade' : 'Add New Trade'}
                  </DialogTitle>
                  <DialogDescription className="text-slate-600">
                    {editingTrade ? 'Update your trade details below.' : 'Enter the details of your trade below.'}
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="symbol" className="text-slate-700">Symbol *</Label>
                      <Input
                        id="symbol"
                        placeholder="e.g., AAPL"
                        className="border-slate-300 focus:border-blue-500"
                        value={formData.symbol}
                        onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="trade_type" className="text-slate-700">Trade Type *</Label>
                      <Select value={formData.trade_type} onValueChange={(value) => setFormData(prev => ({ ...prev, trade_type: value }))}>
                        <SelectTrigger className="border-slate-300 focus:border-blue-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Long">Long</SelectItem>
                          <SelectItem value="Short">Short</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="entry_price" className="text-slate-700">Entry Price *</Label>
                      <Input
                        id="entry_price"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="border-slate-300 focus:border-blue-500"
                        value={formData.entry_price}
                        onChange={(e) => setFormData(prev => ({ ...prev, entry_price: e.target.value }))}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="exit_price" className="text-slate-700">Exit Price</Label>
                      <Input
                        id="exit_price"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="border-slate-300 focus:border-blue-500"
                        value={formData.exit_price}
                        onChange={(e) => setFormData(prev => ({ ...prev, exit_price: e.target.value }))}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="quantity" className="text-slate-700">Quantity *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        placeholder="100"
                        className="border-slate-300 focus:border-blue-500"
                        value={formData.quantity}
                        onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label className="text-slate-700">Trade Date *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal border-slate-300 hover:bg-slate-50"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.trade_date ? format(formData.trade_date, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-white border-slate-200" align="start">
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
                      <Label htmlFor="strategy" className="text-slate-700">Strategy *</Label>
                      <Input
                        id="strategy"
                        placeholder="e.g., Scalping, Swing Trading"
                        className="border-slate-300 focus:border-blue-500"
                        value={formData.strategy}
                        onChange={(e) => setFormData(prev => ({ ...prev, strategy: e.target.value }))}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="pnl" className="text-slate-700">P&L</Label>
                      <Input
                        id="pnl"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="border-slate-300 focus:border-blue-500"
                        value={formData.pnl}
                        onChange={(e) => setFormData(prev => ({ ...prev, pnl: e.target.value }))}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="stop_loss" className="text-slate-700">Stop Loss</Label>
                      <Input
                        id="stop_loss"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="border-slate-300 focus:border-blue-500"
                        value={formData.stop_loss}
                        onChange={(e) => setFormData(prev => ({ ...prev, stop_loss: e.target.value }))}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="take_profit" className="text-slate-700">Take Profit</Label>
                      <Input
                        id="take_profit"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="border-slate-300 focus:border-blue-500"
                        value={formData.take_profit}
                        onChange={(e) => setFormData(prev => ({ ...prev, take_profit: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="notes" className="text-slate-700">Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add any additional notes about this trade..."
                      className="border-slate-300 focus:border-blue-500"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="image" className="text-slate-700">P&L Chart (Optional)</Label>
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      className="border-slate-300 focus:border-blue-500"
                      onChange={handleImageUpload}
                    />
                    {formData.image_data && (
                      <div className="mt-2">
                        <img src={formData.image_data} alt="Trade chart" className="max-w-xs h-auto rounded-lg border border-slate-200" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        resetForm();
                        setIsModalOpen(false);
                      }}
                      className="border-slate-300 text-slate-700 hover:bg-slate-50"
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Trades</CardTitle>
              <BarChart3 className="h-4 w-4 text-slate-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats.total_trades || 0}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total P&L</CardTitle>
              {(stats.total_pnl || 0) >= 0 ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getPnlColor(stats.total_pnl || 0)}`}>
                ${(stats.total_pnl || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Win Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats.win_rate || 0}%</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Avg P&L</CardTitle>
              <BarChart3 className="h-4 w-4 text-slate-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getPnlColor(stats.avg_pnl || 0)}`}>
                ${(stats.avg_pnl || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-8 bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-slate-900">
              <Filter className="w-5 h-5 mr-2" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search" className="text-slate-700">Search Symbol</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="search"
                    placeholder="e.g., AAPL, TSLA"
                    className="pl-9 border-slate-300 focus:border-blue-500"
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="strategy-filter" className="text-slate-700">Strategy</Label>
                <Input
                  id="strategy-filter"
                  placeholder="e.g., Scalping, Swing"
                  className="border-slate-300 focus:border-blue-500"
                  value={filters.strategy}
                  onChange={(e) => setFilters(prev => ({ ...prev, strategy: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="trade-type-filter" className="text-slate-700">Trade Type</Label>
                <Select value={filters.trade_type} onValueChange={(value) => setFilters(prev => ({ ...prev, trade_type: value }))}>
                  <SelectTrigger className="border-slate-300 focus:border-blue-500">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Types</SelectItem>
                    <SelectItem value="Long">Long</SelectItem>
                    <SelectItem value="Short">Short</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-slate-700">Sort By</Label>
                <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                  const [field, order] = value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}>
                  <SelectTrigger className="border-slate-300 focus:border-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at-desc">Latest First</SelectItem>
                    <SelectItem value="created_at-asc">Oldest First</SelectItem>
                    <SelectItem value="pnl-desc">Highest P&L</SelectItem>
                    <SelectItem value="pnl-asc">Lowest P&L</SelectItem>
                    <SelectItem value="symbol-asc">Symbol A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trades Table */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-slate-900">Recent Trades</CardTitle>
            <CardDescription className="text-slate-600">
              {pagination.total} total trades found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="text-slate-700">Symbol</TableHead>
                    <TableHead className="text-slate-700">Type</TableHead>
                    <TableHead className="text-slate-700">Entry</TableHead>
                    <TableHead className="text-slate-700">Exit</TableHead>
                    <TableHead className="text-slate-700">Quantity</TableHead>
                    <TableHead className="text-slate-700">P&L</TableHead>
                    <TableHead className="text-slate-700">Strategy</TableHead>
                    <TableHead className="text-slate-700">Date</TableHead>
                    <TableHead className="text-slate-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                        Loading trades...
                      </TableCell>
                    </TableRow>
                  ) : trades.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                        No trades found. Start by adding your first trade!
                      </TableCell>
                    </TableRow>
                  ) : (
                    trades.map((trade) => (
                      <TableRow key={trade.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium text-slate-900">{trade.symbol}</TableCell>
                        <TableCell>
                          <Badge variant={trade.trade_type === 'Long' ? 'default' : 'secondary'}>
                            {trade.trade_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-700">${trade.entry_price}</TableCell>
                        <TableCell className="text-slate-700">
                          {trade.exit_price ? `$${trade.exit_price}` : '-'}
                        </TableCell>
                        <TableCell className="text-slate-700">{trade.quantity}</TableCell>
                        <TableCell className={getPnlColor(trade.pnl)}>
                          {trade.pnl ? `$${trade.pnl.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="text-slate-700">{trade.strategy}</TableCell>
                        <TableCell className="text-slate-700">
                          {format(new Date(trade.trade_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(trade)}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(trade.id)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
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
                <div className="text-sm text-slate-600">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} trades
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    disabled={pagination.page === 1}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    className="border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    className="border-slate-300 text-slate-700 hover:bg-slate-50"
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-slate-900">
            {editingTrade ? 'Edit Trade' : 'Add New Trade'}
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            {editingTrade ? 'Update your trade details below.' : 'Enter the details of your trade below.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="symbol" className="text-slate-700">Symbol *</Label>
              <Input
                id="symbol"
                placeholder="e.g., AAPL"
                className="border-slate-300 focus:border-blue-500"
                value={formData.symbol}
                onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="trade_type" className="text-slate-700">Trade Type *</Label>
              <Select value={formData.trade_type} onValueChange={(value) => setFormData(prev => ({ ...prev, trade_type: value }))}>
                <SelectTrigger className="border-slate-300 focus:border-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Long">Long</SelectItem>
                  <SelectItem value="Short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="entry_price" className="text-slate-700">Entry Price *</Label>
              <Input
                id="entry_price"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="border-slate-300 focus:border-blue-500"
                value={formData.entry_price}
                onChange={(e) => setFormData(prev => ({ ...prev, entry_price: e.target.value }))}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="exit_price" className="text-slate-700">Exit Price</Label>
              <Input
                id="exit_price"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="border-slate-300 focus:border-blue-500"
                value={formData.exit_price}
                onChange={(e) => setFormData(prev => ({ ...prev, exit_price: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="quantity" className="text-slate-700">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="100"
                className="border-slate-300 focus:border-blue-500"
                value={formData.quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                required
              />
            </div>
            
            <div>
              <Label className="text-slate-700">Trade Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal border-slate-300 hover:bg-slate-50"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.trade_date ? format(formData.trade_date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white border-slate-200" align="start">
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
              <Label htmlFor="strategy" className="text-slate-700">Strategy *</Label>
              <Input
                id="strategy"
                placeholder="e.g., Scalping, Swing Trading"
                className="border-slate-300 focus:border-blue-500"
                value={formData.strategy}
                onChange={(e) => setFormData(prev => ({ ...prev, strategy: e.target.value }))}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="pnl" className="text-slate-700">P&L</Label>
              <Input
                id="pnl"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="border-slate-300 focus:border-blue-500"
                value={formData.pnl}
                onChange={(e) => setFormData(prev => ({ ...prev, pnl: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="stop_loss" className="text-slate-700">Stop Loss</Label>
              <Input
                id="stop_loss"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="border-slate-300 focus:border-blue-500"
                value={formData.stop_loss}
                onChange={(e) => setFormData(prev => ({ ...prev, stop_loss: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="take_profit" className="text-slate-700">Take Profit</Label>
              <Input
                id="take_profit"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="border-slate-300 focus:border-blue-500"
                value={formData.take_profit}
                onChange={(e) => setFormData(prev => ({ ...prev, take_profit: e.target.value }))}
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="notes" className="text-slate-700">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes about this trade..."
              className="border-slate-300 focus:border-blue-500"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          
          <div>
            <Label htmlFor="image" className="text-slate-700">P&L Chart (Optional)</Label>
            <Input
              id="image"
              type="file"
              accept="image/*"
              className="border-slate-300 focus:border-blue-500"
              onChange={handleImageUpload}
            />
            {formData.image_data && (
              <div className="mt-2">
                <img src={formData.image_data} alt="Trade chart" className="max-w-xs h-auto rounded-lg border border-slate-200" />
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                setIsModalOpen(false);
              }}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
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
    <div className="App">
      <TradeJournal />
    </div>
  );
}

export default App;