import { useState, useEffect } from 'react';
import { 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  getDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { useAuth } from './useAuth';

export const useFavoriteGames = () => {
  const { user } = useAuth();
  const [favoriteGames, setFavoriteGames] = useState([]);
  const [mostFavoriteGames, setMostFavoriteGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavoriteGames = async () => {
      if (!user) {
        setFavoriteGames([]);
        setMostFavoriteGames([]);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(firestore, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userFavorites = userSnap.data().favoriteGames || [];
          setFavoriteGames(userFavorites);
          
          
          await fetchMostFavoriteGames(userFavorites);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching favorite games:', error);
        setLoading(false);
      }
    };

    const fetchMostFavoriteGames = async (currentUserFavorites) => {
      try {
        // Mengambil semua data user
        const usersRef = collection(firestore, 'users');
        const querySnapshot = await getDocs(usersRef);
        
        // Menghitung jumlah favorit setiap game
        const gameCounts = {};
        querySnapshot.forEach((userDoc) => {
          const userData = userDoc.data();
          const userFavorites = Array.isArray(userData.favoriteGames) ? userData.favoriteGames : [];
          userFavorites.forEach((game) => {
            gameCounts[game.id] = (gameCounts[game.id] || 0) + 1;
          });
        });

        // Mengonversi object ke array dan mengurutkan berdasarkan jumlah favorit
        const popularityList = Object.entries(gameCounts)
          .map(([id, count]) => ({ id, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        // Mengambil game yang paling populer, tapi tidak dimiliki oleh user
        const currentUserFavoriteIds = new Set(
          currentUserFavorites.map(game => game.id)
        );
        
        const mostFavoriteExcludingUser = popularityList
          .filter(game => !currentUserFavoriteIds.has(game.id));

        setMostFavoriteGames(mostFavoriteExcludingUser);
      } catch (error) {
        console.error('Error fetching most favorite games:', error);
      }
    };

    fetchFavoriteGames();
  }, [user]);

  const addFavoriteGame = async (game) => {
    if (!user) {
      throw new Error('User must be logged in');
    }

    try {
      const userRef = doc(firestore, 'users', user.uid);
      
      // Memastikan game belum ada di favorit
      await updateDoc(userRef, {
        favoriteGames: arrayUnion({
          id: game.id,
          name: game.name,
          background_image: game.background_image,
          rating: game.rating
        })
      });

      // Memperbarui local state
      setFavoriteGames(prev => [...prev, {
        id: game.id,
        name: game.name,
        background_image: game.background_image,
        rating: game.rating
      }]);
    } catch (error) {
      console.error('Error adding favorite game:', error);
      throw error;
    }
  };

  const removeFavoriteGame = async (gameId) => {
    if (!user) {
      throw new Error('User must be logged in');
    }

    try {
      const userRef = doc(firestore, 'users', user.uid);
      
      // Remove game from favorites
      await updateDoc(userRef, {
        favoriteGames: arrayRemove(
          ...favoriteGames.filter(game => game.id === gameId)
        )
      });

      // Update local state
      setFavoriteGames(prev => prev.filter(game => game.id !== gameId));
    } catch (error) {
      console.error('Error removing favorite game:', error);
      throw error;
    }
  };

  const isFavorite = (gameId) => {
    return favoriteGames.some(game => game.id === gameId);
  };

  return { 
    favoriteGames, 
    mostFavoriteGames,
    loading, 
    addFavoriteGame, 
    removeFavoriteGame, 
    isFavorite 
  };
};