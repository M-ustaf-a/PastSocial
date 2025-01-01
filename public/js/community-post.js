 // Define toggleHeart globally to ensure it's available everywhere
 function toggleHeart(element) {
    if (!element) return;

    // Get the current heart icon
    const heartIcon = element.querySelector('img') || element;
    
    // Check current state and toggle
    const currentSrc = heartIcon.getAttribute('src');
    const postId = heartIcon.getAttribute('data-post-id');

    if (currentSrc === '/heart.svg') {
        heartIcon.setAttribute('src', '/heart-fill.svg');
        // Optional: Add like logic here
        console.log(`Liked post ${postId}`);
    } else {
        heartIcon.setAttribute('src', '/heart.svg');
        // Optional: Add unlike logic here
        console.log(`Unliked post ${postId}`);
    }
}