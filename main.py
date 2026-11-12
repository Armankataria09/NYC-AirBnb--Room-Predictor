from fastapi import FastAPI
from pydantic import BaseModel, Field
import pandas as pd
import joblib 
from fastapi.middleware.cors import CORSMiddleware

app=FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

COLUMNS = ['latitude', 'longitude', 'price', 'minimum_nights', 'number_of_reviews',
           'reviews_per_month', 'calculated_host_listings_count', 'availability_365', 'neighbourhood_group', 'neighbourhood']

model= joblib.load("Model_Pipeline.pkl")  # Load the pre-trained model pipeline

#pydantic model= check the input features type
class Features(BaseModel):
    latitude: float = Field(...,ge= -90,le=90,description="Latitude must be between -90 and 90 degrees.")
    longitude: float = Field(...,ge= -180,le=180,description="Longitude must be between -180 and 180 degrees.")
    price: float = Field(...,gt=0,description="Price must be a positive value.")
    minimum_nights: int = Field(...,ge=1,le=365,description="Minimum nights required for booking.")
    number_of_reviews: int = Field(..., ge=0, description="Total number of reviews")
    reviews_per_month: float = Field(..., ge=0, description="Average reviews per month")
    calculated_host_listings_count: int = Field(..., ge=0, description='Number of listings by this host')
    availability_365: int = Field(..., ge=0, le=365, description="Days available out of 365")
    neighbourhood_group: str = Field(..., min_length=1, description="Borough or neighbourhood group")
    neighbourhood: str = Field(..., min_length=1, description="Specific neighbourhood name")



@app.get("/")
def greet():
    return "Hello, World!"

@app.post("/predict")
def predict(features: Features):
    row= pd.DataFrame([features.dict()],columns=COLUMNS,index=[0])
    # Placeholder for prediction logic
    Prediction=model.predict(row)
    probability=model.predict_proba(row)
    return {"predicted_room_type": Prediction[0],
            "probability": probability.tolist()[0]}  # Convert numpy array to list for JSON serialization