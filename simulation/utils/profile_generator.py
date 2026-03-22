import random
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class ProfileGenerator:
    """
    Generate realistic agent profiles based on demographic data
    """
    
    AGE_DISTRIBUTION = {
        (18, 24): 0.15,
        (25, 34): 0.25,
        (35, 44): 0.22,
        (45, 54): 0.18,
        (55, 64): 0.12,
        (65, 80): 0.08
    }
    
    LOCATION_DISTRIBUTION = {
        "Colombo": 0.14,
        "Dehiwala-Mount Lavinia": 0.06,
        "Moratuwa": 0.05,
        "Negombo": 0.04,
        "Sri Jayawardenepura Kotte": 0.04,
        "Kandy": 0.06,
        "Galle": 0.04,
        "Jaffna": 0.03,
        "Trincomalee": 0.03,
        "Batticaloa": 0.03,
        "Anuradhapura": 0.04,
        "Polonnaruwa": 0.02,
        "Kurunegala": 0.04,
        "Ratnapura": 0.03,
        "Badulla": 0.03,
        "Matara": 0.03,
        "Hambantota": 0.02,
        "Vavuniya": 0.02,
        "Nuwara Eliya": 0.03,
        "Kalmunai": 0.02,
        "Ampara": 0.02,
        "Kalutara": 0.03,
        "Gampaha": 0.06,
        "Puttalam": 0.02,
        "Mannar": 0.01,
    }

    BASE_COORDINATES = {
        "Colombo": [6.9271, 79.8612],
        "Dehiwala-Mount Lavinia": [6.8649, 79.8653],
        "Moratuwa": [6.7731, 79.8816],
        "Negombo": [7.2097, 79.8356],
        "Sri Jayawardenepura Kotte": [6.8924, 79.9022],
        "Kandy": [7.2906, 80.6337],
        "Galle": [6.0328, 80.2150],
        "Jaffna": [9.6615, 80.0255],
        "Trincomalee": [8.5874, 81.2152],
        "Batticaloa": [7.7170, 81.6924],
        "Anuradhapura": [8.3114, 80.4037],
        "Polonnaruwa": [7.9403, 81.0188],
        "Kurunegala": [7.4863, 80.3647],
        "Ratnapura": [6.6828, 80.3992],
        "Badulla": [6.9934, 81.0550],
        "Matara": [5.9496, 80.5353],
        "Hambantota": [6.1241, 81.1185],
        "Vavuniya": [8.7514, 80.4971],
        "Nuwara Eliya": [6.9497, 80.7891],
        "Kalmunai": [7.4148, 81.8262],
        "Ampara": [7.2975, 81.6724],
        "Kalutara": [6.5854, 79.9607],
        "Gampaha": [7.0873, 79.9995],
        "Puttalam": [8.0362, 79.8283],
        "Mannar": [8.9810, 79.9044],
    }

    VALUES = [
        "family_oriented", "traditional", "modern", "environmentally_conscious",
        "religious", "career_focused", "community_oriented", "individualistic",
        "health_conscious", "tech_savvy", "budget_conscious", "luxury_oriented",
        "socially_aware", "politically_active"
    ]

    PERSONALITY_TRAITS = [
        "Analytical", "Empathetic", "Traditional", "Ambitious", 
        "Skeptical", "Optimistic", "Cautious", "Social", 
        "Independent", "Loyal", "Creative", "Pragmatic"
    ]

    INCOME_LEVELS = ["Below Poverty Line", "Lower Income", "Lower Middle Income", "Middle Income", "Upper Middle Income", "Upper Income"]
    SOCIAL_MEDIA_USAGE = ["Very High", "High", "Moderate", "Low", "None"]
    POLITICAL_LEANING = ["Progressive", "Moderate", "Conservative", "Nationalist", "Apolitical"]

    OCCUPATIONS_YOUNG = ["Student", "Junior Developer", "Marketing Associate", "Content Creator", "Freelancer"]
    OCCUPATIONS_MID = ["Teacher", "Engineer", "Doctor", "Manager", "Business Owner", "Accountant", "Lawyer"]
    OCCUPATIONS_SENIOR = ["Senior Manager", "Consultant", "Professor", "Retired", "Business Owner"]
    EDUCATION_LEVELS = ["High School", "Bachelor's", "Master's", "PhD", "Professional Certification", "No Formal Education"]

    @classmethod
    def generate_profiles(
        cls,
        n: int = 1000,
        demographic_filter: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        profiles = []
        for i in range(n):
            profiles.append(cls._generate_single_profile(i, demographic_filter))
        return profiles
    
    @classmethod
    def _generate_single_profile(
        cls,
        index: int,
        demographic_filter: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        # Age
        if demographic_filter and 'age_range' in demographic_filter and demographic_filter['age_range']:
            age_range = demographic_filter['age_range']
            age = random.randint(age_range[0], age_range[1])
        else:
            age_bracket = random.choices(list(cls.AGE_DISTRIBUTION.keys()), weights=list(cls.AGE_DISTRIBUTION.values()))[0]
            age = random.randint(*age_bracket)
        
        # Gender
        if demographic_filter and 'gender' in demographic_filter and demographic_filter['gender'] and demographic_filter['gender'] != 'All':
            gender = demographic_filter['gender']
        else:
            gender = random.choice(["Male", "Female"])
        
        # Location
        if demographic_filter and 'location' in demographic_filter and demographic_filter['location'] and demographic_filter['location'] != 'All':
            location = demographic_filter['location']
        else:
            location = random.choices(list(cls.LOCATION_DISTRIBUTION.keys()), weights=list(cls.LOCATION_DISTRIBUTION.values()))[0]
            
        # Occupation
        if age < 25:
            occupation = random.choice(cls.OCCUPATIONS_YOUNG)
        elif age < 55:
            occupation = random.choice(cls.OCCUPATIONS_MID)
        else:
            occupation = random.choice(cls.OCCUPATIONS_SENIOR)
            
        # Education
        if age < 22:
            education = "High School"
        else:
            education = random.choices(cls.EDUCATION_LEVELS, weights=[0.2, 0.40, 0.25, 0.05, 0.05, 0.05])[0]

        # Values
        if demographic_filter and 'values' in demographic_filter and demographic_filter['values']:
            required_values = demographic_filter['values']
            other_values = [v for v in cls.VALUES if v not in required_values]
            extra_values = random.sample(other_values, min(2, len(other_values)))
            values = required_values + extra_values
        else:
            num_values = random.randint(2, 4)
            values = random.sample(cls.VALUES, num_values)

        # Coordinates with jitter
        base_coords = cls.BASE_COORDINATES.get(location, [7.8731, 80.7718])
        lat = base_coords[0] + random.uniform(-0.12, 0.12)
        lng = base_coords[1] + random.uniform(-0.12, 0.12)

        # Income Level
        if demographic_filter and 'income_level' in demographic_filter and demographic_filter['income_level']:
            income_level = random.choice(demographic_filter['income_level'])
        elif occupation in ["Student", "Retired"] or age < 22:
            income_level = random.choices(cls.INCOME_LEVELS, weights=[0.1, 0.4, 0.3, 0.15, 0.05, 0.0])[0]
        elif occupation in ["Business Owner", "Senior Manager", "Doctor", "Lawyer"]:
            income_level = random.choices(cls.INCOME_LEVELS, weights=[0.0, 0.0, 0.1, 0.3, 0.4, 0.2])[0]
        else:
            income_level = random.choices(cls.INCOME_LEVELS, weights=[0.05, 0.2, 0.3, 0.3, 0.1, 0.05])[0]

        # Religion and Ethnicity
        if location in ["Jaffna", "Vavuniya", "Mannar", "Batticaloa", "Trincomalee"]:
            religions = ["Hindu", "Christian", "Muslim", "Buddhist"]
            rel_weights = [0.65, 0.15, 0.15, 0.05]
            ethnicities = ["Tamil", "Moor", "Sinhalese", "Burgher"]
            eth_weights = [0.80, 0.10, 0.05, 0.05]
        elif location in ["Kalmunai", "Ampara"]:
            religions = ["Muslim", "Buddhist", "Hindu", "Christian"]
            rel_weights = [0.55, 0.30, 0.10, 0.05]
            ethnicities = ["Moor", "Sinhalese", "Tamil", "Burgher"]
            eth_weights = [0.55, 0.30, 0.10, 0.05]
        else:
            religions = ["Buddhist", "Hindu", "Muslim", "Christian"]
            rel_weights = [0.70, 0.13, 0.10, 0.07]
            ethnicities = ["Sinhalese", "Tamil", "Moor", "Burgher"]
            eth_weights = [0.74, 0.15, 0.09, 0.02]

        if demographic_filter and 'religion' in demographic_filter and demographic_filter['religion']:
            religion = random.choice(demographic_filter['religion'])
        else:
            religion = random.choices(religions, weights=rel_weights)[0]

        ethnicity = random.choices(ethnicities, weights=eth_weights)[0]

        # Name Generation based on Ethnicity
        if ethnicity == "Sinhalese":
            first_names = ["Nuwan", "Chamara", "Dilanka", "Sachini", "Nimasha", "Kasun", "Tharaka", "Malsha", "Dinuka", "Sandali"]
            surnames = ["Perera", "Silva", "Fernando", "Jayasinghe", "Wickramasinghe", "Gunasekara", "Rajapaksa", "Dissanayake", "Bandara"]
        elif ethnicity == "Tamil":
            first_names = ["Arjun", "Priya", "Kavitha", "Suresh", "Anitha", "Rajan", "Meena", "Vijay", "Lakshmi", "Krishnan"]
            surnames = ["Nair", "Pillai", "Shankar", "Murugan", "Selvam", "Balasingham", "Ratnasingham", "Thambipillai"]
        elif ethnicity == "Moor":
            first_names = ["Mohamed", "Fathima", "Hassan", "Ayesha", "Ibrahim", "Zainab", "Rashid", "Nusrath", "Farhan", "Shifana"]
            surnames = ["Marikar", "Lafir", "Cader", "Zarook", "Ismail", "Saheed"]
        else: # Burgher / Other
            first_names = ["Jerome", "Michelle", "Kevin", "Sandra", "Brian", "Karen"]
            surnames = ["de Silva", "van Dort", "Ondaatje", "Grenier"]

        name = f"{random.choice(first_names)} {random.choice(surnames)}"

        # Social Media Usage
        if age < 30:
            social_media_usage = random.choices(cls.SOCIAL_MEDIA_USAGE, weights=[0.4, 0.4, 0.15, 0.05, 0.0])[0]
        elif age < 50:
            social_media_usage = random.choices(cls.SOCIAL_MEDIA_USAGE, weights=[0.1, 0.3, 0.4, 0.15, 0.05])[0]
        else:
            social_media_usage = random.choices(cls.SOCIAL_MEDIA_USAGE, weights=[0.0, 0.1, 0.3, 0.4, 0.2])[0]

        # Political Leaning
        political_leaning = random.choice(cls.POLITICAL_LEANING)

        # Personality Traits
        personality_traits = random.sample(cls.PERSONALITY_TRAITS, random.randint(2, 3))

        return {
            "agent_id": f"agent_{index:04d}",
            "name": name,
            "age": age,
            "gender": gender,
            "location": location,
            "coordinates": [lat, lng],
            "occupation": occupation,
            "education": education,
            "income_level": income_level,
            "religion": religion,
            "ethnicity": ethnicity,
            "social_media_usage": social_media_usage,
            "political_leaning": political_leaning,
            "personality_traits": personality_traits,
            "values": values,
            "bio": ""
        }
    
    @classmethod
    def generate_social_network(
        cls,
        profiles: List[Dict[str, Any]],
        avg_friends: int = 10
    ) -> Dict[str, List[str]]:
        network = {p['agent_id']: [] for p in profiles}
        for profile in profiles:
            agent_id = profile['agent_id']
            candidates = []
            for other in profiles:
                if other['agent_id'] == agent_id:
                    continue
                score = 0
                if other['location'] == profile['location']:
                    score += 3
                shared_values = set(profile['values']) & set(other['values'])
                score += len(shared_values) * 2
                age_diff = abs(profile['age'] - other['age'])
                if age_diff <= 10:
                    score += 2
                elif age_diff <= 20:
                    score += 1
                if score > 0:
                    candidates.append((other['agent_id'], score))
            candidates.sort(key=lambda x: x[1], reverse=True)
            num_friends = max(1, int(random.gauss(avg_friends, 3)))
            num_friends = min(num_friends, len(candidates))
            if candidates:
                selected = []
                for cand_id, score in candidates[:num_friends * 2]:
                    if len(selected) >= num_friends:
                        break
                    if random.random() < (score / 10):
                        selected.append(cand_id)
                network[agent_id] = selected
        return network
