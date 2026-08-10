import math

MONTH_DAYS = 30.42
MINUTES_PER_MONTH = MONTH_DAYS * 24 * 60


def round_up_ptus(required_ptus, minimum_ptus, scale_increment):
    if required_ptus < 0:
        raise ValueError("Required PTUs cannot be negative")
    if minimum_ptus <= 0 or scale_increment <= 0:
        raise ValueError("PTU minimum and scale increment must be positive")

    return max(minimum_ptus, math.ceil(required_ptus / scale_increment) * scale_increment)

def calculate_google_ptu_num(input_text_token, image_number, output_token, rpm, output_token_multiplier, chars_per_gsu, char_per_image_less_128k, char_per_image_larger_128k, cache_hit_rate=0):
    print(f"debugging>>input_token: {input_text_token}, output_token: {output_token}, rpm: {rpm}, output_token_multiplier: {output_token_multiplier}, chars_per_gsu: {chars_per_gsu}")
    # calculate the image token
    googke_image_token = 0 
    if input_text_token <= 128000:
        googke_image_token = (char_per_image_less_128k * image_number)/4
    else:
        googke_image_token = (char_per_image_larger_128k * image_number)/4
    
    # Apply cache hit rate to the input text token calculation
    # Cache hits still consume GSUs but at a potentially reduced rate
    effective_input_text_token = input_text_token  # No reduction in GSU consumption for cache hits in standard calculation
        
    return ((effective_input_text_token + googke_image_token + (output_token * output_token_multiplier)) * 4 * (rpm / 60) ) / chars_per_gsu

def calculate_gpt4o_image_token_number(width, height, detail_level, model):
    """
    Calculate the token cost for processing an image based on the model, image dimensions,
    and level of detail.

    Parameters:
    - width (int): The width of the image in pixels.
    - height (int): The height of the image in pixels.
    - detail_level (str): 'low' or 'high', representing the level of image detail.
    - model (str): The model name ('GPT-4o', 'GPT-4 Turbo with Vision', or 'GPT-4o mini').

    Calculation Logic:
    Image inputs are metered and charged in tokens, just as text inputs are. The token cost of an image is determined by two factors: size and detail.

    Low res cost
        Any image with detail: low costs 85 tokens.

    High res cost
        To calculate the cost of an image with detail: high, we do the following:

    Scale to fit within a 2048px x 2048px square, maintaining original aspect ratio Scale so that the image's shortest side is 768px long Count the number of 512px squares in the image—each square costs 170 tokens
    Add 85 tokens to the total Cost calculation examples A 1024 x 1024 square image in detail: high mode costs 765 tokens 1024 is less than 2048, so there is no initial resize.  The shortest side is 1024, so we scale the image down to 768 x 768.  4 512px square tiles are needed to represent the image, so the final token cost is 170 * 4 + 85 = 765.  A 2048 x 4096 image in detail: high mode costs 1105 tokens We scale down the image to 1024 x 2048 to fit within the 2048 square.  The shortest side is 1024, so we further scale down to 768 x 1536.  6 512px tiles are needed, so the final token cost is 170 * 6 + 85 = 1105.  A 4096 x 8192 image in detail: low most costs 85 tokens Regardless of input size, low detail images are a fixed cost.

    https://platform.openai.com/docs/guides/vision/calculating-costs

    Returns:
    - int: The total token cost for processing the image.
    """
    if detail_level.lower() not in ['low', 'high']:
        raise ValueError("Invalid detail level. Must be 'low' or 'high'.")
    
    detail_level = detail_level.lower()
    model = model.strip()

    if detail_level == 'low':
        return 85  # Flat rate for low detail
    else:
        token_cost_per_tile = 170
        base_token_cost = 85
    
    if width <= 0 or height <= 0:
        return 0

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

def calculate_tpm_per_1_dollar(input_text_token, input_image_token, output_token, rpm, ptu_cost):
    return ((input_text_token + input_image_token + output_token ) * rpm) / (ptu_cost / MINUTES_PER_MONTH) / 1_000_000
    

def calculate_provisioned_ptu_num(
    input_token,
    image_input_token,
    output_token,
    peak_calls_per_min,
    minimum_ptus,
    scale_increment,
    input_tpm_per_ptu,
    output_to_input_ratio,
    cache_hit_rate=0,
):
    if not 0 <= cache_hit_rate <= 100:
        raise ValueError("Cache hit rate must be between 0 and 100")
    if input_tpm_per_ptu <= 0 or output_to_input_ratio <= 0:
        raise ValueError("Throughput values must be positive")

    effective_text_input = input_token * (1 - cache_hit_rate / 100)
    total_input_tpm = peak_calls_per_min * (effective_text_input + image_input_token)
    total_output_tpm = peak_calls_per_min * output_token
    normalized_tpm = total_input_tpm + (total_output_tpm * output_to_input_ratio)
    required_ptus = normalized_tpm / input_tpm_per_ptu
    deployable_ptus = round_up_ptus(required_ptus, minimum_ptus, scale_increment)
    return required_ptus, deployable_ptus, total_input_tpm, total_output_tpm, normalized_tpm
    

def calculate_ptu_utilization(ptu_num, min_ptu_deployment_unit, scale_increment=None):
    scale_increment = scale_increment or min_ptu_deployment_unit
    deployed_ptus = round_up_ptus(ptu_num, min_ptu_deployment_unit, scale_increment)
    utilization = ptu_num / deployed_ptus
    return f"{utilization * 100:.2f}% ({ptu_num}/{deployed_ptus})"

def calculate_paygo_cost(input_token, output_token, rpm, model_name, cache_hit_rate=0, detailed=False):
    import json
    import os

    # Load model configuration
    config_path = os.path.join(os.path.dirname(__file__), 'model_config.json')
    with open(config_path, 'r') as f:
        model_config = json.load(f)["models"]

    # Get model-specific configuration
    selected_model_config = next((model for model in model_config if model["model name"] == model_name), None)
    if not selected_model_config:
        raise ValueError(f"Model {model_name} not found in configuration")

    input_token_price = selected_model_config["input token price per 1k"]
    input_token_price_cache_hit = selected_model_config["input token price per 1k with cache hit"]
    output_token_price = selected_model_config["output token price per 1k"]

    # Calculate tokens with and without cache hits
    cache_hit_tokens = input_token * (cache_hit_rate / 100)
    non_cache_hit_tokens = input_token * (1 - (cache_hit_rate / 100))

    # Calculate PayGO cost
    input_cost_no_cache = ((non_cache_hit_tokens * rpm * MINUTES_PER_MONTH) / 1000) * input_token_price
    input_cost_with_cache = ((cache_hit_tokens * rpm * MINUTES_PER_MONTH) / 1000) * input_token_price_cache_hit
    input_cost = input_cost_no_cache + input_cost_with_cache
    output_cost = ((output_token * rpm * MINUTES_PER_MONTH) / 1000) * output_token_price

    if detailed:
        if cache_hit_rate > 0:
            input_cost_detail = (
                f"Non-cached ({non_cache_hit_tokens} tokens): (({non_cache_hit_tokens} * {rpm} * 60 * 24 * 30.42) / 1000) * {input_token_price:.6f} = {input_cost_no_cache:.2f}\n"
                f"Cached ({cache_hit_tokens} tokens): (({cache_hit_tokens} * {rpm} * 60 * 24 * 30.42) / 1000) * {input_token_price_cache_hit:.6f} = {input_cost_with_cache:.2f}\n"
                f"Total input cost: {input_cost_no_cache:.2f} + {input_cost_with_cache:.2f} = {input_cost:.2f}"
            )
        else:
            input_cost_detail = f"(({input_token} * {rpm} * 60 * 24 * 30.42) / 1000) * {input_token_price:.6f} = {input_cost:.2f}"
        
        output_cost_detail = f"(({output_token} * {rpm} * 60 * 24 * 30.42) / 1000) * {output_token_price:.6f} = {output_cost:.2f}"
        total_cost = f"{input_cost:.2f} + {output_cost:.2f} = {input_cost + output_cost:.2f}"
        return input_cost_detail, output_cost_detail, total_cost
    else:
        return input_cost + output_cost

def calculate_ptu_cost(ptu_num, min_ptu_deployment_unit, ptu_price_per_unit, ptu_discount, detailed=False, scale_increment=None):
    scale_increment = scale_increment or min_ptu_deployment_unit
    deployed_ptus = round_up_ptus(ptu_num, min_ptu_deployment_unit, scale_increment)
    result = deployed_ptus * ptu_price_per_unit
    discounted_result = result * (1 - ptu_discount)
    if detailed:
        discounted_result = f"({result})* (1 - {ptu_discount:.2f}) = {discounted_result}"
        result = f"({deployed_ptus} PTUs) * {ptu_price_per_unit:.2f} = {result}"
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


def build_calculation_explanation(
    *,
    model_name,
    provider,
    model_config,
    input_text_tokens,
    input_image_tokens,
    output_tokens,
    rpm,
    cache_hit_rate,
    required_ptus,
    minimum_ptus,
    scale_increment,
    ptu_price_per_unit,
    ptu_discount,
    paygo_cost,
    ptu_cost,
    tpm_per_dollar,
    cost_saving_percentage,
    commitment_type,
    deployment_type=None,
    ptu_metrics=None,
    image_count=0,
):
    cached_tokens_per_request = input_text_tokens * cache_hit_rate / 100
    non_cached_tokens_per_request = input_text_tokens - cached_tokens_per_request
    monthly_requests = rpm * MINUTES_PER_MONTH
    input_price = model_config["input token price per 1k"]
    cached_input_price = model_config["input token price per 1k with cache hit"]
    output_price = model_config["output token price per 1k"]
    non_cached_input_cost = (
        non_cached_tokens_per_request * monthly_requests / 1000 * input_price
    )
    cached_input_cost = (
        cached_tokens_per_request * monthly_requests / 1000 * cached_input_price
    )
    output_cost = output_tokens * monthly_requests / 1000 * output_price
    deployed_ptus = round_up_ptus(required_ptus, minimum_ptus, scale_increment)
    utilization = required_ptus / deployed_ptus * 100
    ptu_cost_before_discount = deployed_ptus * ptu_price_per_unit
    total_tpm = (input_text_tokens + input_image_tokens + output_tokens) * rpm
    hourly_ptu_cost = ptu_cost / (MONTH_DAYS * 24)
    per_minute_ptu_cost = ptu_cost / MINUTES_PER_MONTH

    if paygo_cost:
        savings_value = (paygo_cost - ptu_cost) / paygo_cost * 100
    else:
        savings_value = 0

    steps = [
        {
            "output": "Monthly requests",
            "result": monthly_requests,
            "unit": "requests/month",
            "formula": r"R_{\text{month}} = RPM \times 60 \times 24 \times 30.42",
            "substitution": (
                rf"R_{{\text{{month}}}} = {rpm} \times 60 \times 24 \times "
                rf"30.42 = {monthly_requests:,.2f}"
            ),
        },
        {
            "output": "Monthly PayGO input cost",
            "result": non_cached_input_cost + cached_input_cost,
            "unit": "USD/month",
            "formula": (
                r"C_{\text{input}} = "
                r"\frac{T_{\text{noncache}} \times R_{\text{month}}}{1000}P_{\text{input}}"
                r" + \frac{T_{\text{cache}} \times R_{\text{month}}}{1000}P_{\text{cache}}"
            ),
            "substitution": (
                rf"C_{{\text{{input}}}} = "
                rf"\frac{{{non_cached_tokens_per_request:,.2f} \times {monthly_requests:,.2f}}}{{1000}}"
                rf"\times {input_price:.8f} + "
                rf"\frac{{{cached_tokens_per_request:,.2f} \times {monthly_requests:,.2f}}}{{1000}}"
                rf"\times {cached_input_price:.8f} = "
                rf"{non_cached_input_cost:,.2f} + {cached_input_cost:,.2f} = "
                rf"{non_cached_input_cost + cached_input_cost:,.2f}"
            ),
            "note": (
                f"{input_text_tokens:,} text input tokens/request split into "
                f"{non_cached_tokens_per_request:,.2f} non-cached and "
                f"{cached_tokens_per_request:,.2f} cached tokens at a "
                f"{cache_hit_rate}% cache-hit rate."
            ),
        },
        {
            "output": "Monthly PayGO output cost",
            "result": output_cost,
            "unit": "USD/month",
            "formula": (
                r"C_{\text{output}} = "
                r"\frac{T_{\text{output}} \times R_{\text{month}}}{1000}P_{\text{output}}"
            ),
            "substitution": (
                rf"C_{{\text{{output}}}} = "
                rf"\frac{{{output_tokens:,.2f} \times {monthly_requests:,.2f}}}{{1000}}"
                rf"\times {output_price:.8f} = {output_cost:,.2f}"
            ),
        },
        {
            "output": "PayGO cost",
            "result": paygo_cost,
            "unit": "USD/month",
            "formula": r"C_{\text{PayGO}} = C_{\text{input}} + C_{\text{output}}",
            "substitution": (
                rf"C_{{\text{{PayGO}}}} = "
                rf"{non_cached_input_cost + cached_input_cost:,.2f} + "
                rf"{output_cost:,.2f} = {paygo_cost:,.2f}"
            ),
            "note": (
                "The current app's PayGO calculation charges text input and output tokens. "
                f"The {input_image_tokens:,.0f} calculated image input tokens are used in "
                "PTU sizing and TPM-per-dollar, but are not added to PayGO cost."
                if input_image_tokens
                else None
            ),
        },
    ]

    if provider == "Azure OpenAI":
        metrics = ptu_metrics or {}
        effective_text_input = metrics.get(
            "effective_text_input",
            input_text_tokens * (1 - cache_hit_rate / 100),
        )
        total_input_tpm = metrics.get(
            "total_input_tpm",
            rpm * (effective_text_input + input_image_tokens),
        )
        total_output_tpm = metrics.get("total_output_tpm", rpm * output_tokens)
        output_ratio = model_config["output token multiple ratio"]
        normalized_tpm = metrics.get(
            "normalized_tpm",
            total_input_tpm + output_ratio * total_output_tpm,
        )
        input_tpm_per_ptu = model_config["input TPM per PTU"]
        steps.extend(
            [
                {
                    "output": "Effective text input tokens",
                    "result": effective_text_input,
                    "unit": "tokens/request",
                    "formula": (
                        r"T_{\text{effective}} = T_{\text{input}}"
                        r"\left(1-\frac{\text{cache hit rate}}{100}\right)"
                    ),
                    "substitution": (
                        rf"T_{{\text{{effective}}}} = {input_text_tokens} "
                        rf"\left(1-\frac{{{cache_hit_rate}}}{{100}}\right)"
                        rf" = {effective_text_input:,.2f}"
                    ),
                },
                {
                    "output": "Normalized TPM",
                    "result": normalized_tpm,
                    "unit": "normalized tokens/minute",
                    "formula": (
                        r"TPM_{\text{normalized}} = "
                        r"RPM(T_{\text{effective}}+T_{\text{image}})"
                        r" + r_{\text{output}}(RPM \times T_{\text{output}})"
                    ),
                    "substitution": (
                        rf"TPM_{{\text{{normalized}}}} = "
                        rf"{rpm}({effective_text_input:,.2f}+{input_image_tokens:,.2f})"
                        rf" + {output_ratio}({rpm}\times {output_tokens})"
                        rf" = {total_input_tpm:,.2f} + "
                        rf"{output_ratio}\times {total_output_tpm:,.2f}"
                        rf" = {normalized_tpm:,.2f}"
                    ),
                },
                {
                    "output": "Required PTU Num",
                    "result": required_ptus,
                    "unit": "raw PTUs",
                    "formula": (
                        r"PTU_{\text{required}} = "
                        r"\frac{TPM_{\text{normalized}}}{TPM_{\text{input per PTU}}}"
                    ),
                    "substitution": (
                        rf"PTU_{{\text{{required}}}} = "
                        rf"\frac{{{normalized_tpm:,.2f}}}{{{input_tpm_per_ptu:,.2f}}}"
                        rf" = {required_ptus:,.4f}"
                    ),
                },
            ]
        )
    elif provider == "Google":
        output_ratio = model_config["output token multiple ratio"]
        chars_per_gsu = model_config["chars per GSU"]
        chars_per_image = (
            model_config["chars per image(<=128k input tokens)"]
            if input_text_tokens <= 128000
            else model_config["chars per image(>128k input tokens)"]
        )
        estimated_image_tokens = chars_per_image * image_count / 4
        steps.append(
            {
                "output": "Required PTU Num",
                "result": required_ptus,
                "unit": "raw GSUs",
                "formula": (
                    r"GSU_{\text{required}} = "
                    r"\frac{(T_{\text{input}}+T_{\text{image}}"
                    r"+r_{\text{output}}T_{\text{output}})"
                    r"\times 4 \times (RPM/60)}{\text{characters per GSU}}"
                ),
                "substitution": (
                    rf"GSU_{{\text{{required}}}} = "
                    rf"\frac{{({input_text_tokens}+{estimated_image_tokens:,.2f}"
                    rf"+{output_ratio}\times {output_tokens})"
                    rf"\times 4 \times ({rpm}/60)}}{{{chars_per_gsu}}}"
                    rf" = {required_ptus:,.4f}"
                ),
            }
        )
    else:
        steps.append(
            {
                "output": "Required PTU Num",
                "result": required_ptus,
                "unit": "raw PTUs",
                "formula": r"PTU_{\text{required}} = \text{user supplied capacity estimate}",
                "substitution": rf"PTU_{{\text{{required}}}} = {required_ptus:,.4f}",
                "note": (
                    "Microsoft publishes input TPM per PTU for this model but not the "
                    "output-token weighting needed for an automatic mixed-workload estimate."
                ),
            }
        )

    steps.extend(
        [
            {
                "output": "Deployable PTUs",
                "result": deployed_ptus,
                "unit": "PTUs",
                "formula": (
                    r"PTU_{\text{deployed}} = \max\left("
                    r"PTU_{\min},"
                    r"\left\lceil\frac{PTU_{\text{required}}}{I_{\text{scale}}}\right\rceil"
                    r"I_{\text{scale}}\right)"
                ),
                "substitution": (
                    rf"PTU_{{\text{{deployed}}}} = \max\left({minimum_ptus},"
                    rf"\left\lceil\frac{{{required_ptus:,.4f}}}{{{scale_increment}}}\right\rceil"
                    rf"\times {scale_increment}\right) = {deployed_ptus}"
                ),
            },
            {
                "output": "PTU Utilization",
                "result": utilization,
                "unit": "%",
                "formula": (
                    r"U_{\text{PTU}} = "
                    r"\frac{PTU_{\text{required}}}{PTU_{\text{deployed}}}\times 100"
                ),
                "substitution": (
                    rf"U_{{\text{{PTU}}}} = "
                    rf"\frac{{{required_ptus:,.4f}}}{{{deployed_ptus}}}\times 100"
                    rf" = {utilization:,.2f}\%"
                ),
            },
            {
                "output": "PTU cost",
                "result": ptu_cost,
                "unit": "USD/month",
                "formula": (
                    r"C_{\text{PTU}} = PTU_{\text{deployed}}"
                    r"\times P_{\text{PTU}}\times(1-d)"
                ),
                "substitution": (
                    rf"C_{{\text{{PTU}}}} = {deployed_ptus}\times "
                    rf"{ptu_price_per_unit:,.2f}\times(1-{ptu_discount:.4f})"
                    rf" = {ptu_cost_before_discount:,.2f}\times"
                    rf"(1-{ptu_discount:.4f}) = {ptu_cost:,.2f}"
                ),
                "note": (
                    f"{commitment_type} commitment; "
                    f"{deployment_type or 'configured deployment type'}. "
                    f"Equivalent PTU cost is ${hourly_ptu_cost:,.2f}/hour."
                ),
            },
            {
                "output": "TPM per dollar (in millions)",
                "result": tpm_per_dollar,
                "unit": "million TPM/USD",
                "formula": (
                    r"E_{\text{TPM/\$}} = "
                    r"\frac{(T_{\text{input}}+T_{\text{image}}+T_{\text{output}})"
                    r"\times RPM}{C_{\text{PTU}}/(30.42\times24\times60)}"
                    r"\div 10^6"
                ),
                "substitution": (
                    rf"E_{{\text{{TPM/\$}}}} = "
                    rf"\frac{{({input_text_tokens}+{input_image_tokens}+{output_tokens})"
                    rf"\times {rpm}}}{{{ptu_cost:,.2f}/({MONTH_DAYS}\times24\times60)}}"
                    rf"\div 10^6 = \frac{{{total_tpm:,.2f}}}{{{per_minute_ptu_cost:,.6f}}}"
                    rf"\div 10^6 = {tpm_per_dollar:,.4f}"
                ),
            },
            {
                "output": "PTU Cost Saving (%)",
                "result": savings_value,
                "unit": "%",
                "formula": (
                    r"S_{\text{PTU}} = "
                    r"\frac{C_{\text{PayGO}}-C_{\text{PTU}}}{C_{\text{PayGO}}}\times100"
                ),
                "substitution": (
                    rf"S_{{\text{{PTU}}}} = "
                    rf"\frac{{{paygo_cost:,.2f}-{ptu_cost:,.2f}}}{{{paygo_cost:,.2f}}}"
                    rf"\times100 = {savings_value:,.2f}\%"
                    if paygo_cost
                    else r"S_{\text{PTU}} = 0\% \quad (C_{\text{PayGO}}=0)"
                ),
                "note": (
                    f"Stored comparison value: {cost_saving_percentage}."
                ),
            },
        ]
    )

    return {
        "model_name": model_name,
        "provider": provider,
        "deployment_type": deployment_type,
        "commitment_type": commitment_type,
        "inputs": {
            "input_text_tokens": input_text_tokens,
            "input_image_tokens": input_image_tokens,
            "output_tokens": output_tokens,
            "rpm": rpm,
            "cache_hit_rate": cache_hit_rate,
            "minimum_ptus": minimum_ptus,
            "scale_increment": scale_increment,
            "input_price_per_1k": input_price,
            "cached_input_price_per_1k": cached_input_price,
            "output_price_per_1k": output_price,
            "ptu_price_per_unit": ptu_price_per_unit,
            "ptu_discount": ptu_discount,
        },
        "steps": steps,
    }
