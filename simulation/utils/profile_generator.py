"""
Profile generator for creating diverse agent demographics
"""
import random
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class ProfileGenerator:
    """
    Generate realistic agent profiles based on demographic data
    
    Profiles include:
    - Demographics (age, gender, location)
    - Occupation and education
    - Core values that influence reactions
    """
    
    # Age distribution (approximate)
    AGE_DISTRIBUTION = {
        (18, 24): 0.15,
        (25, 34): 0.25,
        (35, 44): 0.22,
        (45, 54): 0.18,
        (55, 64): 0.12,
        (65, 80): 0.08
    }
    
    # Location distribution — Sri Lankan cities
    LOCATION_DISTRIBUTION = {
        "Colombo": 0.35,
        "Gampaha": 0.25,
        "Kandy": 0.20,
        "Galle": 0.12,
        "Jaffna": 0.08,
    }

    # Base coordinates for map plotting (lat, lng)
    BASE_COORDINATES = {
        "Colombo": [6.9271, 79.8612],
        "Gampaha": [7.0873, 79.9995],
        "Kandy": [7.2906, 80.6337],
        "Galle": [6.0328, 80.2150],
        "Jaffna": [9.6615, 80.0255],
    }
    
    # Possible values that agents can hold
    VALUES = [
        "family_oriented",
        "traditional",
        "modern",
        "environmentally_conscious",
        "religious",
        "career_focused",
        "community_oriented",
        "individualistic",
        "health_conscious",
        "tech_savvy",
        "budget_conscious",
        "luxury_oriented",
        "socially_aware",
        "politically_active"
    ]
    
    # Occupations by age bracket
    OCCUPATIONS_YOUNG = ["Student", "Junior Developer", "Marketing Associate", "Content Creator", "Freelancer"]
    OCCUPATIONS_MID = ["Teacher", "Engineer", "Doctor", "Manager", "Business Owner", "Accountant", "Lawyer"]
    OCCUPATIONS_SENIOR = ["Senior Manager", "Consultant", "Professor", "Retired", "Business Owner"]
    
    # Education levels
    EDUCATION_LEVELS = ["High School", "Bachelor's", "Master's", "PhD", "Professional Certification"]
    
    @classmethod
    def generate_profiles(
        cls,
        n: int = 1000,
        demographic_filter: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate n agent profiles
        
        Args:
            n: Number of profiles to generate
            demographic_filter: Optional filter for target demographics
                - age_range: [min_age, max_age]
                - location: str
                - gender: "Male" or "Female"
                - values: list of required values
        
        Returns:
            List of profile dictionaries
        """
        profiles = []
        
        for i in range(n):
            profile = cls._generate_single_profile(i, demographic_filter)
            profiles.append(profile)
        
        return profiles
    
    @classmethod
    def _generate_single_profile(
        cls,
        index: int,
        demographic_filter: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate a single profile"""
        
        # Age
        if demographic_filter and 'age_range' in demographic_filter:
            age_range = demographic_filter['age_range']
            age = random.randint(age_range[0], age_range[1])
        else:
            age_bracket = random.choices(
                list(cls.AGE_DISTRIBUTION.keys()),
                weights=list(cls.AGE_DISTRIBUTION.values())
            )[0]
            age = random.randint(*age_bracket)
        
        # Gender
        if demographic_filter and 'gender' in demographic_filter:
            gender = demographic_filter['gender']
        else:
            gender = random.choice(["Male", "Female"])
        
        # Location
        if demographic_filter and 'location' in demographic_filter:
            location = demographic_filter['location']
        else:
            location = random.choices(
                list(cls.LOCATION_DISTRIBUTION.keys()),
                weights=list(cls.LOCATION_DISTRIBUTION.values())
            )[0]
        
        # Occupation based on age
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
            education = random.choices(
                cls.EDUCATION_LEVELS,
                weights=[0.2, 0.45, 0.25, 0.05, 0.05]
            )[0]
        
        # Values (2-4 random values)
        if demographic_filter and 'values' in demographic_filter:
            # Include required values plus some random ones
            required_values = demographic_filter['values']
            other_values = [v for v in cls.VALUES if v not in required_values]
            extra_values = random.sample(other_values, min(2, len(other_values)))
            values = required_values + extra_values
        else:
            num_values = random.randint(2, 4)
            values = random.sample(cls.VALUES, num_values)
        
        # Coordinates with jitter for map plotting
        if location not in cls.BASE_COORDINATES:
            logger.warning(f"Unknown location '{location}', falling back to center of Sri Lanka coordinates")
            
        base_coords = cls.BASE_COORDINATES.get(location, [7.8731, 80.7718])  # fallback: center of Sri Lanka
        lat = base_coords[0] + random.uniform(-0.05, 0.05)
        lng = base_coords[1] + random.uniform(-0.05, 0.05)

        return {
            "agent_id": f"agent_{index:04d}",
            "age": age,
            "gender": gender,
            "location": location,
            "coordinates": [lat, lng],
            "occupation": occupation,
            "education": education,
            "values": values
        }
    
    @classmethod
    def generate_social_network(
        cls,
        profiles: List[Dict[str, Any]],
        avg_friends: int = 10
    ) -> Dict[str, List[str]]:
        """
        Create friend connections between agents
        
        Uses similarity-based connections:
        - Same location increases connection probability
        - Shared values increase connection probability
        - Similar age increases connection probability
        
        Args:
            profiles: List of agent profiles
            avg_friends: Average number of friends per agent
        
        Returns:
            Dict mapping agent_id to list of friend agent_ids
        """
        network = {p['agent_id']: [] for p in profiles}
        profile_by_id = {p['agent_id']: p for p in profiles}
        
        for profile in profiles:
            agent_id = profile['agent_id']
            
            # Find similar agents
            candidates = []
            for other in profiles:
                if other['agent_id'] == agent_id:
                    continue
                
                # Calculate similarity score
                score = 0
                
                # Same location
                if other['location'] == profile['location']:
                    score += 3
                
                # Shared values
                shared_values = set(profile['values']) & set(other['values'])
                score += len(shared_values) * 2
                
                # Similar age (within 10 years)
                age_diff = abs(profile['age'] - other['age'])
                if age_diff <= 10:
                    score += 2
                elif age_diff <= 20:
                    score += 1
                
                if score > 0:
                    candidates.append((other['agent_id'], score))
            
            # Sort by score and select top friends
            candidates.sort(key=lambda x: x[1], reverse=True)
            
            # Random number of friends around average
            num_friends = max(1, int(random.gauss(avg_friends, 3)))
            num_friends = min(num_friends, len(candidates))
            
            # Select friends with probability weighted by score
            if candidates:
                selected = []
                for cand_id, score in candidates[:num_friends * 2]:
                    if len(selected) >= num_friends:
                        break
                    # Higher score = higher probability of selection
                    if random.random() < (score / 10):
                        selected.append(cand_id)
                
                network[agent_id] = selected
        
        return network
