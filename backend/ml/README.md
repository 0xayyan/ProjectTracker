# ProjectWatch predictive analytics

The predictive layer uses the March 2026 PAIMANA project dataset as an offline training source.

## Data preparation

Run:

`python ml/data_preparation.py`

This creates:

- `data/processed/cost_prediction_dataset.csv`
- `data/processed/schedule_prediction_dataset.csv`

The schedule dataset only contains projects whose original target date had not passed at the March 2026 snapshot. Revised cost and revised target date are used only to create outcome labels and are never model inputs.

## Statistical baseline

Run:

`python ml/statistical_baseline.py`

The baseline is Logistic Regression.

## Machine learning model

Run:

`python ml/machine_learning_models.py`

The machine learning model is Random Forest.

## Model comparison

Run:

`python ml/model_comparison.py`

The comparison is between the statistical baseline and the Random Forest using the same train/test split and evaluation metrics.

## Application prediction

The FastAPI application loads the saved models from `data/processed` through `ml/predictor.py`.

The live application uses only numeric fields available in the current project schema, so prediction features remain aligned between training and serving.

The current PAIMANA source is a single March 2026 snapshot. It supports retrospective proof-of-concept prediction and driver analysis. A longitudinal early-warning model should use repeated monthly observations of the same projects.
