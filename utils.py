def calculate_ptu_num(input_token, output_token, rpm, output_token_multiplier, chars_per_gsu):
    return ((input_token + (output_token * output_token_multiplier)) * (rpm / 60) * 4 ) / chars_per_gsu

def calculate_ptu_utilization(ptu_num, min_ptu_deployment_unit):
    # Dummy function to calculate PTU utilization
    import math
    return ptu_num / (math.ceil(ptu_num / min_ptu_deployment_unit) * min_ptu_deployment_unit)

def calculate_paygo_cost(input_token, output_token, rpm, model_name):
    import json
    import os

    # Load model configuration
    config_path = os.path.join(os.path.dirname(__file__), 'model_config.json')
    with open(config_path, 'r') as f:
        model_config = json.load(f)

    # Get model-specific configuration
    selected_model_config = next((model for model in model_config if model["model name"] == model_name), None)
    if not selected_model_config:
        raise ValueError(f"Model {model_name} not found in configuration")

    input_token_price = selected_model_config["input token price per 1k"]
    output_token_price = selected_model_config["output token price per 1k"]

    # Calculate PayGO cost
    input_cost = ((input_token * (rpm / 60) * 3600 * 24 * 30) / 1000) * input_token_price
    output_cost = ((output_token * (rpm / 60) * 3600 * 24 * 30) / 1000) * output_token_price

    return input_cost + output_cost

def calculate_ptu_cost(ptu_num, min_ptu_deployment_unit, ptu_price_per_unit):
    import math
    result = (math.ceil(ptu_num / min_ptu_deployment_unit) * min_ptu_deployment_unit) * ptu_price_per_unit 
    return result

def calculate_cost_saving_percentage(ptu_cost, paygo_cost):
    """
    Calculate the percentage of cost saving by PTU cost compared to PayGO cost.
    """
    if paygo_cost == 0:
        return 0
    return ((paygo_cost - ptu_cost) / paygo_cost) * 100
