from config import HIGH_VALUE_CATEGORIES, SCORING_WEIGHTS, PRIORITY_THRESHOLDS


def calculate_score(business: dict) -> dict:
    score = 0

    if not business.get("website"):
        score += SCORING_WEIGHTS["no_website"]

    rating = business.get("rating") or 0
    if rating >= 4.5:
        score += SCORING_WEIGHTS["rating_excellent"]
    elif rating >= 4.0:
        score += SCORING_WEIGHTS["rating_good"]

    reviews = business.get("reviews_count") or 0
    if reviews >= 100:
        score += SCORING_WEIGHTS["reviews_high"]
    elif reviews >= 50:
        score += SCORING_WEIGHTS["reviews_medium"]

    category = (business.get("category") or "").lower()
    if any(hvc in category for hvc in HIGH_VALUE_CATEGORIES):
        score += SCORING_WEIGHTS["high_value_category"]

    if business.get("phone"):
        score += SCORING_WEIGHTS["has_phone"]

    if score >= PRIORITY_THRESHOLDS["high"]:
        priority = "high"
    elif score >= PRIORITY_THRESHOLDS["medium"]:
        priority = "medium"
    else:
        priority = "low"

    return {"lead_score": score, "priority": priority}
