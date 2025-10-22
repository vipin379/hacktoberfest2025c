// Example: subtle hover animation on profile image (optional)
const profileImg = document.querySelector('.profile-img');

profileImg.addEventListener('mouseenter', () => {
    profileImg.style.transform = 'scale(1.05)';
    profileImg.style.transition = 'transform 0.3s ease';
});
profileImg.addEventListener('mouseleave', () => {
    profileImg.style.transform = 'scale(1)';
});
