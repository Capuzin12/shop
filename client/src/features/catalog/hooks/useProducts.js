import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../../api';

export function useProducts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const loadMoreRef = useRef(null);
  const loadMoreObserverRef = useRef(null);

  const [filters, setFilters] = useState({
    category_id: searchParams.get('category_id') || '',
    search: searchParams.get('search') || '',
    min_price: '',
    max_price: '',
    brand_ids: searchParams.get('brand_ids') || '',
    sort_by: 'name',
    sort_order: 'asc',
  });

  // Ініціалізація товарів та пагінації з sessionStorage
  const [products, setProducts] = useState(() => {
    const saved = sessionStorage.getItem('catalog_products_cache');
    return saved ? JSON.parse(saved).products : [];
  });

  const [pagination, setPagination] = useState(() => {
    const saved = sessionStorage.getItem('catalog_products_cache');
    const savedPage = saved ? JSON.parse(saved).pagination : null;
    return savedPage || {
      page: parseInt(searchParams.get('page'), 10) || 1,
      limit: parseInt(searchParams.get('limit'), 10) || 12,
      total: 0,
      totalPages: 0,
    };
  });

  const [categories, setCategories] = useState([]);
  const [brandFacets, setBrandFacets] = useState([]);
  const [suggestions, setSuggestions] = useState({ products: [], categories: [], brands: [] });
  const [loading, setLoading] = useState(() => !sessionStorage.getItem('catalog_products_cache'));
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchMeta, setSearchMeta] = useState({ mode: 'strict', hint: null });
  const [cardView, setCardView] = useState(searchParams.get('card_view') || 'comfortable');

  useEffect(() => {
    const searchParam = searchParams.get('search') || '';
    const categoryParam = searchParams.get('category_id') || '';
    const minPriceParam = searchParams.get('min_price') || '';
    const maxPriceParam = searchParams.get('max_price') || '';
    const brandIdsParam = searchParams.get('brand_ids') || '';
    const sortByParam = searchParams.get('sort_by') || 'name';
    const sortOrderParam = searchParams.get('sort_order') || 'asc';
    const limitParam = parseInt(searchParams.get('limit'), 10) || 12;
    const cardViewParam = searchParams.get('card_view') || 'comfortable';

    setFilters({
      category_id: categoryParam,
      search: searchParam,
      min_price: minPriceParam,
      max_price: maxPriceParam,
      brand_ids: brandIdsParam,
      sort_by: sortByParam,
      sort_order: sortOrderParam,
    });
    setPagination((prev) => ({ ...prev, limit: limitParam }));
    setCardView(cardViewParam);
  }, [searchParams]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/api/categories');
        const categoriesData = response.data;
        setCategories(Array.isArray(categoriesData) ? categoriesData.filter((category) => category && category.id) : []);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const query = (filters.search || '').trim();
    if (query.length < 1) {
      setSuggestions({ products: [], categories: [], brands: [] });
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.get('/api/search/suggestions', { params: { q: query } });
        setSuggestions(response.data || { products: [], categories: [], brands: [] });
      } catch {
        setSuggestions({ products: [], categories: [], brands: [] });
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  const productsRequestKey = useMemo(
      () => JSON.stringify({ ...filters, limit: pagination.limit }),
      [filters, pagination.limit]
  );

  const fetchProducts = useCallback(async ({ page = 1, append = false } = {}) => {
    if (!append) {
      const saved = sessionStorage.getItem('catalog_products_cache');
      if (saved && products.length > 0) {
        return;
      }
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = {
        page,
        limit: pagination.limit,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order,
      };

      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.search) params.search = filters.search;
      if (filters.min_price) params.min_price = filters.min_price;
      if (filters.max_price) params.max_price = filters.max_price;
      if (filters.brand_ids) params.brand_ids = filters.brand_ids;

      const response = await api.get('/api/products', { params });
      const productsData = response.data.products;
      const validProducts = Array.isArray(productsData) ? productsData.filter((product) => product && product.id) : [];

      setProducts((prev) => {
        if (!append) return validProducts;
        const next = [...prev];
        const existing = new Set(prev.map((item) => item.id));
        validProducts.forEach((item) => {
          if (!existing.has(item.id)) next.push(item);
        });
        return next;
      });
      setBrandFacets(response.data?.facets?.brands || []);
      setSearchMeta({
        mode: response.data?.search_mode || 'strict',
        hint: response.data?.search_hint || null,
      });
      setPagination((prev) => ({
        ...prev,
        total: response.data.total || 0,
        totalPages: response.data.total_pages || 0,
        page,
      }));
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      if (!append) setLoading(false);
      else setLoadingMore(false);
    }
  }, [filters, pagination.limit, products.length]);

  useEffect(() => {
    const saved = sessionStorage.getItem('catalog_products_cache');
    if (saved) {
      const cachedFilters = JSON.parse(saved).filters;
      if (JSON.stringify(cachedFilters) === JSON.stringify(filters) && products.length > 0) {
        return;
      }
    }
    setProducts([]);
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchProducts({ page: 1, append: false });
  }, [fetchProducts, productsRequestKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Збереження стану в кеш сесії
  useEffect(() => {
    if (products.length > 0) {
      sessionStorage.setItem('catalog_products_cache', JSON.stringify({ products, pagination, filters }));
    }
  }, [products, pagination, filters]);

  const hasMore = pagination.totalPages ? pagination.page < pagination.totalPages : false;

  useEffect(() => {
    if (!loadMoreRef.current) return undefined;
    if (loadMoreObserverRef.current) {
      loadMoreObserverRef.current.disconnect();
    }

    loadMoreObserverRef.current = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (!first?.isIntersecting || loading || loadingMore || !hasMore) return;
      fetchProducts({ page: pagination.page + 1, append: true });
    }, { root: null, rootMargin: '600px 0px', threshold: 0 });

    loadMoreObserverRef.current.observe(loadMoreRef.current);
    return () => {
      loadMoreObserverRef.current?.disconnect();
    };
  }, [fetchProducts, hasMore, loading, loadingMore, pagination.page, productsRequestKey]);

  return {
    brandFacets,
    cardView,
    categories,
    filters,
    hasMore,
    loading,
    loadingMore,
    loadMoreRef,
    pagination,
    products,
    searchMeta,
    searchParams,
    setCardView,
    setFilters,
    setPagination,
    setSearchParams,
    suggestions,
  };
}