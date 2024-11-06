import math

def calculate_google_ptu_num(input_text_token, input_image_token, output_token, rpm, output_token_multiplier, chars_per_gsu):
    print(f"debugging>>input_token: {input_text_token}, output_token: {output_token}, rpm: {rpm}, output_token_multiplier: {output_token_multiplier}, chars_per_gsu: {chars_per_gsu}")
    return ((input_text_token + input_image_token + (output_token * output_token_multiplier)) * 4 * (rpm / 60) ) / chars_per_gsu

def calculate_gpt4o_image_token_number(width, height, detail_level, model):
    """
    Calculate the token cost for processing an image based on the model, image dimensions,
    and level of detail.

    Parameters:
    - width (int): The width of the image in pixels.
    - height (int): The height of the image in pixels.
    - detail_level (str): 'low' or 'high', representing the level of image detail.
    - model (str): The model name ('GPT-4o', 'GPT-4 Turbo with Vision', or 'GPT-4o mini').

    Returns:
    - int: The total token cost for processing the image.
    """
    if detail_level.lower() not in ['low', 'high']:
        raise ValueError("Invalid detail level. Must be 'low' or 'high'.")
    
    detail_level = detail_level.lower()
    model = model.strip()

    if 'gpt-4o' in model.lower() or 'gpt-4 turbo with vision' in model.lower():
        # Standard models
        if detail_level == 'low':
            return 85  # Flat rate for low detail
        else:  # High detail
            token_cost_per_tile = 170
            base_token_cost = 85
    elif 'gpt-4o mini' in model.lower():
        # Mini model
        if detail_level == 'low':
            return 2833  # Flat rate for low detail
        else:
            token_cost_per_tile = 5667
            base_token_cost = 2833
    else:
        raise ValueError("Invalid model name. Must be 'GPT-4o', 'GPT-4 Turbo with Vision', or 'GPT-4o mini'.")

    # High detail mode calculations
    # Step 1: Resize image to fit within a 2048 x 2048 pixel square
    scaling_factor = min(2048 / width, 2048 / height, 1.0)
    resized_width = width * scaling_factor
    resized_height = height * scaling_factor

    # Step 2: If the shortest side > 768 pixels, resize so the shortest side is 768 pixels
    shortest_side = min(resized_width, resized_height)
    if shortest_side > 768:
        scaling_factor_2 = 768 / shortest_side
        resized_width *= scaling_factor_2
        resized_height *= scaling_factor_2

    # Step 3: Calculate the number of 512 x 512 pixel tiles
    tiles_w = math.ceil(resized_width / 512)
    tiles_h = math.ceil(resized_height / 512)
    total_tiles = tiles_w * tiles_h

    # Step 4: Calculate the total token cost
    token_cost = int(total_tiles * token_cost_per_tile + base_token_cost)

    return token_cost

def calculate_azure_openai_ptu_num(model_name, input_token, image_input_token,output_token, peak_calls_per_min):
    # Model configurations
    if model_name == 'azure openai GPT-4o':
        DEPLOYABLE_INCREMENT = 50
        INPUT_TPM_PER_PTU = 2500
        OUTPUT_TPM_PER_PTU = 833
    elif model_name == 'azure openai GPT-4o-mini':
        DEPLOYABLE_INCREMENT = 25
        INPUT_TPM_PER_PTU = 37000
        OUTPUT_TPM_PER_PTU = 12_333
    else:
        raise ValueError("Unsupported model. Choose 'azure openai GPT-4o' or 'azure openai GPT-4o-mini'")

    
    # Calculate total input tokens per call
    total_input_tokens_per_call = input_token + image_input_token

    # Calculate tokens per minute
    total_input_tpm = peak_calls_per_min * total_input_tokens_per_call
    total_output_tpm = peak_calls_per_min * output_token
    total_tokens_per_minute = total_input_tpm + total_output_tpm

    # Calculate required PTUs
    required_input_ptus = total_input_tpm / INPUT_TPM_PER_PTU
    required_output_ptus = total_output_tpm / OUTPUT_TPM_PER_PTU
    total_required_ptus = required_input_ptus + required_output_ptus

    # Calculate deployable PTUs
    deployable_ptus = math.ceil(total_required_ptus / DEPLOYABLE_INCREMENT) * DEPLOYABLE_INCREMENT
    return deployable_ptus, total_required_ptus, total_input_tpm, total_output_tpm, total_tokens_per_minute
    

def calculate_ptu_utilization(ptu_num, min_ptu_deployment_unit):
    import math
    utilization = ptu_num / (math.ceil(ptu_num / min_ptu_deployment_unit) * min_ptu_deployment_unit)
    return f"{utilization * 100:.2f}% ({ptu_num}/{(math.ceil(ptu_num / min_ptu_deployment_unit) * min_ptu_deployment_unit)})"

def calculate_paygo_cost(input_token, output_token, rpm, model_name, detailed=False):
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
    input_cost  = ((input_token  * (rpm / 60) * 3600 * 24 * 30.42) / 1000) * input_token_price
    output_cost = ((output_token * (rpm / 60) * 3600 * 24 * 30.42) / 1000) * output_token_price

    if detailed:
        total_cost = f"{input_cost} + {output_cost} = {input_cost + output_cost}"
        input_cost = f"(({input_token}  * ({rpm} / 60) * 3600 * 24 * 30.42) / 1000) * {input_token_price:.6f} = {input_cost}"
        output_cost = f"(({output_token} * ({rpm} / 60) * 3600 * 24 * 30.42) / 1000) * {output_token_price:.6f} = {output_cost}"
        return input_cost, output_cost, total_cost
    else:
        return input_cost + output_cost

def calculate_ptu_cost(ptu_num, min_ptu_deployment_unit, ptu_price_per_unit, ptu_discount, detailed=False):
    import math
    result = (math.ceil(ptu_num / min_ptu_deployment_unit) * min_ptu_deployment_unit) * ptu_price_per_unit
    discounted_result = result * (1 - ptu_discount)
    if detailed:
        discounted_result = f"({result})* (1 - {ptu_discount:.2f}) = {discounted_result}"
        result = f"({math.ceil(ptu_num / min_ptu_deployment_unit)} * {min_ptu_deployment_unit}) * {ptu_price_per_unit:.2f} = {result}"
        return result, discounted_result
    else:
        return discounted_result

def calculate_cost_saving_percentage(ptu_cost, paygo_cost):
    """
    Calculate the percentage of cost saving by PTU cost compared to PayGO cost.
    """
    if paygo_cost == 0:
        return 0
    saving_percentage = ((paygo_cost - ptu_cost) / paygo_cost) * 100
    return f"{saving_percentage:.2f}%"

def calculate_gemini_image_token(width, height, quality, model):
    # Dummy function for calculating image tokens for Gemini models
    # Replace with actual implementation later
    return 0
