from fastapi import FastAPI, APIRouter, HTTPException, Query, File, UploadFile
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, date
import base64
from enum import Enum


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Enums and Models
class TradeType(str, Enum):
    LONG = "Long"
    SHORT = "Short"

class Trade(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str
    entry_price: float
    exit_price: Optional[float] = None
    quantity: int
    trade_date: date
    pnl: Optional[float] = None
    strategy: str
    trade_type: TradeType
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    notes: Optional[str] = None
    image_data: Optional[str] = None  # base64 encoded image
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TradeCreate(BaseModel):
    symbol: str
    entry_price: float
    exit_price: Optional[float] = None
    quantity: int
    trade_date: date
    pnl: Optional[float] = None
    strategy: str
    trade_type: TradeType
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    notes: Optional[str] = None
    image_data: Optional[str] = None

class TradeUpdate(BaseModel):
    symbol: Optional[str] = None
    entry_price: Optional[float] = None
    exit_price: Optional[float] = None
    quantity: Optional[int] = None
    trade_date: Optional[date] = None
    pnl: Optional[float] = None
    strategy: Optional[str] = None
    trade_type: Optional[TradeType] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    notes: Optional[str] = None
    image_data: Optional[str] = None

class TradeResponse(BaseModel):
    trades: List[Trade]
    total: int
    page: int
    limit: int
    total_pages: int

# Trade Routes
@api_router.post("/trades", response_model=Trade)
async def create_trade(trade: TradeCreate):
    trade_dict = trade.dict()
    trade_obj = Trade(**trade_dict)
    
    # Calculate P&L if exit_price is provided
    if trade_obj.exit_price and trade_obj.entry_price:
        if trade_obj.trade_type == TradeType.LONG:
            trade_obj.pnl = (trade_obj.exit_price - trade_obj.entry_price) * trade_obj.quantity
        else:  # SHORT
            trade_obj.pnl = (trade_obj.entry_price - trade_obj.exit_price) * trade_obj.quantity
    
    result = await db.trades.insert_one(trade_obj.dict())
    if result.inserted_id:
        return trade_obj
    raise HTTPException(status_code=500, detail="Failed to create trade")

@api_router.get("/trades", response_model=TradeResponse)
async def get_trades(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    strategy: Optional[str] = Query(None),
    trade_type: Optional[TradeType] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    pnl_min: Optional[float] = Query(None),
    pnl_max: Optional[float] = Query(None),
    sort_by: Optional[str] = Query("created_at"),
    sort_order: Optional[str] = Query("desc")
):
    # Build filter query
    filter_query = {}
    
    if search:
        filter_query["symbol"] = {"$regex": search, "$options": "i"}
    
    if strategy:
        filter_query["strategy"] = {"$regex": strategy, "$options": "i"}
    
    if trade_type:
        filter_query["trade_type"] = trade_type
    
    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = date_from
        if date_to:
            date_filter["$lte"] = date_to
        filter_query["trade_date"] = date_filter
    
    if pnl_min is not None or pnl_max is not None:
        pnl_filter = {}
        if pnl_min is not None:
            pnl_filter["$gte"] = pnl_min
        if pnl_max is not None:
            pnl_filter["$lte"] = pnl_max
        filter_query["pnl"] = pnl_filter
    
    # Build sort query
    sort_direction = -1 if sort_order == "desc" else 1
    sort_query = [(sort_by, sort_direction)]
    
    # Get total count
    total = await db.trades.count_documents(filter_query)
    
    # Get paginated results
    skip = (page - 1) * limit
    trades_cursor = db.trades.find(filter_query).sort(sort_query).skip(skip).limit(limit)
    trades_list = await trades_cursor.to_list(length=limit)
    
    trades = [Trade(**trade) for trade in trades_list]
    total_pages = (total + limit - 1) // limit
    
    return TradeResponse(
        trades=trades,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages
    )

@api_router.get("/trades/{trade_id}", response_model=Trade)
async def get_trade(trade_id: str):
    trade_doc = await db.trades.find_one({"id": trade_id})
    if not trade_doc:
        raise HTTPException(status_code=404, detail="Trade not found")
    return Trade(**trade_doc)

@api_router.put("/trades/{trade_id}", response_model=Trade)
async def update_trade(trade_id: str, trade_update: TradeUpdate):
    # Get existing trade
    existing_trade = await db.trades.find_one({"id": trade_id})
    if not existing_trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Prepare update data
    update_data = {k: v for k, v in trade_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # Recalculate P&L if prices are updated
    if "exit_price" in update_data or "entry_price" in update_data or "quantity" in update_data:
        entry_price = update_data.get("entry_price", existing_trade["entry_price"])
        exit_price = update_data.get("exit_price", existing_trade.get("exit_price"))
        quantity = update_data.get("quantity", existing_trade["quantity"])
        trade_type = update_data.get("trade_type", existing_trade["trade_type"])
        
        if exit_price and entry_price:
            if trade_type == TradeType.LONG:
                update_data["pnl"] = (exit_price - entry_price) * quantity
            else:  # SHORT
                update_data["pnl"] = (entry_price - exit_price) * quantity
    
    # Update trade
    result = await db.trades.update_one(
        {"id": trade_id},
        {"$set": update_data}
    )
    
    if result.modified_count:
        updated_trade = await db.trades.find_one({"id": trade_id})
        return Trade(**updated_trade)
    
    raise HTTPException(status_code=500, detail="Failed to update trade")

@api_router.delete("/trades/{trade_id}")
async def delete_trade(trade_id: str):
    result = await db.trades.delete_one({"id": trade_id})
    if result.deleted_count:
        return {"message": "Trade deleted successfully"}
    raise HTTPException(status_code=404, detail="Trade not found")

@api_router.get("/trades/stats/summary")
async def get_trade_stats():
    pipeline = [
        {
            "$group": {
                "_id": None,
                "total_trades": {"$sum": 1},
                "total_pnl": {"$sum": "$pnl"},
                "winning_trades": {
                    "$sum": {"$cond": [{"$gt": ["$pnl", 0]}, 1, 0]}
                },
                "losing_trades": {
                    "$sum": {"$cond": [{"$lt": ["$pnl", 0]}, 1, 0]}
                },
                "avg_pnl": {"$avg": "$pnl"}
            }
        }
    ]
    
    result = await db.trades.aggregate(pipeline).to_list(1)
    if result:
        stats = result[0]
        win_rate = (stats["winning_trades"] / stats["total_trades"] * 100) if stats["total_trades"] > 0 else 0
        return {
            "total_trades": stats["total_trades"],
            "total_pnl": round(stats["total_pnl"] or 0, 2),
            "winning_trades": stats["winning_trades"],
            "losing_trades": stats["losing_trades"],
            "win_rate": round(win_rate, 2),
            "avg_pnl": round(stats["avg_pnl"] or 0, 2)
        }
    
    return {
        "total_trades": 0,
        "total_pnl": 0,
        "winning_trades": 0,
        "losing_trades": 0,
        "win_rate": 0,
        "avg_pnl": 0
    }

# Legacy routes for testing
@api_router.get("/")
async def root():
    return {"message": "Trading Journal API"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()